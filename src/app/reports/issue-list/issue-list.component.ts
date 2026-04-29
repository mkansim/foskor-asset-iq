import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MaintenanceIssueService } from '../../services/maintenance-issue.service';
import { MaintenanceIssue } from '../../models/maintenanceI-issue.model';

import {
  Chart,
  ChartConfiguration,
  registerables
} from 'chart.js';

import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

Chart.register(...registerables);

@Component({
  selector: 'app-issue-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './issue-list.component.html',
  styleUrls: ['./issue-list.component.scss']
})
export class IssueListComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('statusPieCanvas') statusPieCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('sectionBarCanvas') sectionBarCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('responsibleBarCanvas') responsibleBarCanvas!: ElementRef<HTMLCanvasElement>;

  issues: MaintenanceIssue[] = [];
  filteredIssues: MaintenanceIssue[] = [];

  private chartSourceIssues: MaintenanceIssue[] = [];

  searchText = '';
  statusFilter = '';

  dataSource: 'database' | 'excel' = 'database';
  importedFileName = '';

  statusOptions: string[] = [
    'Open',
    'In Progress',
    'Closed',
    'Overdue',
    'Completed',
    'New',
    'Not started',
    'Cancelled'
  ];

  sortColumn: keyof MaintenanceIssue | '' = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  currentPage = 1;
  pageSize = 5;
  totalItems = 0;
  totalPages = 1;

  private statusPieChart?: Chart<'pie'>;
  private sectionBarChart?: Chart<'bar'>;
  private responsibleBarChart?: Chart<'bar'>;

  private readonly chartColors: string[] = [
    '#2563eb',
    '#16a34a',
    '#f97316',
    '#9333ea',
    '#dc2626',
    '#0891b2',
    '#ca8a04',
    '#4f46e5',
    '#db2777',
    '#059669',
    '#7c3aed',
    '#ea580c',
    '#0f766e',
    '#be123c',
    '#1d4ed8',
    '#65a30d'
  ];

  constructor(private maintenanceIssueService: MaintenanceIssueService) {}

  ngOnInit(): void {
    this.loadIssuesFromDatabase();
  }

  ngAfterViewInit(): void {
    this.createCharts();
    this.updateCharts(this.chartSourceIssues);
  }

  ngOnDestroy(): void {
    this.statusPieChart?.destroy();
    this.sectionBarChart?.destroy();
    this.responsibleBarChart?.destroy();
  }

  loadIssuesFromDatabase(): void {
    this.dataSource = 'database';
    this.importedFileName = '';
    this.currentPage = 1;
    this.searchText = '';
    this.statusFilter = '';

    this.maintenanceIssueService.getIssues().subscribe({
      next: (data) => {
        this.issues = data.map(issue => ({
          ...issue,
          dueDate: issue.dueDate ? new Date(issue.dueDate) : new Date(),
          createdAt: issue.createdAt ? new Date(issue.createdAt) : new Date()
        }));

        this.refreshStatusOptions();
        this.applyFilters();
      },
      error: (error) => {
        console.error('Failed to load maintenance issues:', error);

        this.issues = [];
        this.filteredIssues = [];
        this.chartSourceIssues = [];

        this.totalItems = 0;
        this.totalPages = 1;

        this.updateCharts([]);
      }
    });
  }

  onExcelFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    this.importedFileName = file.name;

    const reader = new FileReader();

    reader.onload = (e: ProgressEvent<FileReader>) => {
      const arrayBuffer = e.target?.result;

      if (!arrayBuffer) {
        return;
      }

      const workbook = XLSX.read(arrayBuffer, {
        type: 'array',
        cellDates: true
      });

      const sheetName = workbook.SheetNames.includes('Tailings')
        ? 'Tailings'
        : workbook.SheetNames[0];

      const worksheet = workbook.Sheets[sheetName];

      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
        defval: '',
        raw: false
      });

      const importedIssues = rows
        .map((row, index) => this.mapExcelRowToMaintenanceIssue(row, index))
        .filter(issue =>
          issue.section ||
          issue.equipment ||
          issue.problemIssue ||
          issue.responsiblePerson
        );

      this.dataSource = 'excel';
      this.issues = importedIssues;
      this.currentPage = 1;
      this.searchText = '';
      this.statusFilter = '';

      this.refreshStatusOptions();
      this.applyFilters();

      input.value = '';
    };

    reader.readAsArrayBuffer(file);
  }

  private mapExcelRowToMaintenanceIssue(
    row: Record<string, any>,
    index: number
  ): MaintenanceIssue {
    const dueDateValue = this.getExcelValue(row, [
      'Due date',
      'Due Date',
      'DueDate',
      'New date',
      'New Date'
    ]);

    const totalPlantStoppageValue = this.getExcelValue(row, [
      'Total Plant Stoppage Required',
      'Total plant stoppage required',
      'TotalPlantStoppageRequired'
    ]);

    const timeRequiredValue = this.getExcelValue(row, [
      'Time Required',
      'Time Required Hours',
      'TimeRequiredHours'
    ]);

    const status = this.cleanString(this.getExcelValue(row, ['Status'])) || 'Open';

    return {
      id: index + 1,
      section: this.cleanString(this.getExcelValue(row, ['Section'])),
      equipment: this.cleanString(this.getExcelValue(row, ['Equipment'])),
      problemIssue: this.cleanString(
        this.getExcelValue(row, [
          'Problem/Issue',
          'Problem / Issue',
          'Problem Issue',
          'Problems',
          'ProblemIssue'
        ])
      ),
      source: this.cleanString(this.getExcelValue(row, ['Source'])),
      cause: this.cleanString(this.getExcelValue(row, ['Cause'])),
      action: this.cleanString(this.getExcelValue(row, ['Action'])),
      criticality: this.cleanString(this.getExcelValue(row, ['Criticality'])) || 'Medium',
      responsiblePerson: this.cleanString(
        this.getExcelValue(row, [
          'Responsible person',
          'Responsible Person',
          'Responsible',
          'responsiblePerson'
        ])
      ),
      dueDate: this.parseExcelDate(dueDateValue),
      totalPlantStoppageRequired: this.parsePlantStoppageRequired(totalPlantStoppageValue),
      timeRequiredHours: this.parseNumber(timeRequiredValue),
      status,
      comments: this.cleanString(
        this.getExcelValue(row, ['Comments', 'Comment'])
      ),
      createdAt: new Date()
    };
  }

  private getExcelValue(row: Record<string, any>, possibleKeys: string[]): any {
    const normalizedRow: Record<string, any> = {};

    Object.keys(row).forEach(key => {
      normalizedRow[key.trim().toLowerCase()] = row[key];
    });

    for (const key of possibleKeys) {
      const value = normalizedRow[key.trim().toLowerCase()];

      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }

    return '';
  }

  private cleanString(value: any): string {
    if (value === undefined || value === null) {
      return '';
    }

    return String(value).trim();
  }

  private parseNumber(value: any): number {
    if (value === undefined || value === null || value === '') {
      return 0;
    }

    const parsed = Number(String(value).replace(',', '.'));

    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private parsePlantStoppageRequired(value: any): boolean {
    const text = this.cleanString(value).toLowerCase();

    if (!text) {
      return false;
    }

    if (
      text.includes('no shutdown') ||
      text.includes('no stoppage') ||
      text === 'no' ||
      text === 'false'
    ) {
      return false;
    }

    if (
      text.includes('shutdown') ||
      text.includes('stoppage') ||
      text === 'yes' ||
      text === 'true'
    ) {
      return true;
    }

    return false;
  }

  private parseExcelDate(value: any): Date {
    if (!value) {
      return new Date();
    }

    if (value instanceof Date && !isNaN(value.getTime())) {
      return value;
    }

    if (typeof value === 'number') {
      const parsed = XLSX.SSF.parse_date_code(value);

      if (parsed) {
        return new Date(parsed.y, parsed.m - 1, parsed.d);
      }
    }

    const text = String(value).trim();

    const ddMmYyyyMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

    if (ddMmYyyyMatch) {
      const day = Number(ddMmYyyyMatch[1]);
      const month = Number(ddMmYyyyMatch[2]);
      const year = Number(ddMmYyyyMatch[3]);

      return new Date(year, month - 1, day);
    }

    const parsedDate = new Date(text);

    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }

    return new Date();
  }

  private refreshStatusOptions(): void {
    const defaultStatuses = [
      'Open',
      'In Progress',
      'Closed',
      'Overdue',
      'Completed',
      'New',
      'Not started',
      'Cancelled'
    ];

    const currentStatuses = this.issues
      .map(issue => issue.status)
      .filter(status => !!status);

    this.statusOptions = Array.from(
      new Set([...defaultStatuses, ...currentStatuses])
    );
  }

  onSearch(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  onStatusFilterChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  applyFilters(): void {
    let results = [...this.issues];

    const search = this.searchText.trim().toLowerCase();

    if (search) {
      results = results.filter(issue =>
        issue.responsiblePerson?.toLowerCase().includes(search) ||
        issue.section?.toLowerCase().includes(search) ||
        issue.equipment?.toLowerCase().includes(search) ||
        issue.problemIssue?.toLowerCase().includes(search) ||
        issue.comments?.toLowerCase().includes(search)
      );
    }

    if (this.statusFilter) {
      results = results.filter(issue => issue.status === this.statusFilter);
    }

    if (this.sortColumn) {
      results = this.sortIssues(results);
    }

    this.chartSourceIssues = results;

    this.totalItems = results.length;
    this.totalPages = Math.ceil(this.totalItems / this.pageSize) || 1;

    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }

    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;

    this.filteredIssues = results.slice(startIndex, endIndex);

    this.updateCharts(results);
  }

  onSort(column: keyof MaintenanceIssue): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.applyFilters();
  }

  getSortIcon(column: keyof MaintenanceIssue): string {
    if (this.sortColumn !== column) {
      return '↕';
    }

    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

  sortIssues(data: MaintenanceIssue[]): MaintenanceIssue[] {
    return data.sort((a, b) => {
      const valueA = a[this.sortColumn as keyof MaintenanceIssue];
      const valueB = b[this.sortColumn as keyof MaintenanceIssue];

      let comparison = 0;

      if (valueA instanceof Date && valueB instanceof Date) {
        comparison = valueA.getTime() - valueB.getTime();
      } else if (typeof valueA === 'number' && typeof valueB === 'number') {
        comparison = valueA - valueB;
      } else if (typeof valueA === 'boolean' && typeof valueB === 'boolean') {
        comparison = Number(valueA) - Number(valueB);
      } else {
        comparison = String(valueA ?? '').localeCompare(String(valueB ?? ''));
      }

      return this.sortDirection === 'asc' ? comparison : -comparison;
    });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) {
      return;
    }

    this.currentPage = page;
    this.applyFilters();
  }

  getStatusClass(status: string | undefined | null): string {
    const safeStatus = String(status || 'unknown')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-');

    return `status-${safeStatus}`;
  }

  private createCharts(): void {
    if (
      !this.statusPieCanvas ||
      !this.sectionBarCanvas ||
      !this.responsibleBarCanvas
    ) {
      return;
    }

    const statusCounts = this.countByField(this.chartSourceIssues, 'status');
    const sectionCounts = this.countByField(this.chartSourceIssues, 'section');
    const responsibleCounts = this.countByField(this.chartSourceIssues, 'responsiblePerson');

    this.statusPieChart = new Chart(this.statusPieCanvas.nativeElement, {
      type: 'pie',
      data: {
        labels: statusCounts.labels,
        datasets: [
          {
            data: statusCounts.values,
            backgroundColor: this.getStatusColors(statusCounts.labels),
            borderColor: '#ffffff',
            borderWidth: 2
          }
        ]
      },
      options: this.getPieChartOptions()
    });

    this.sectionBarChart = new Chart(this.sectionBarCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: sectionCounts.labels,
        datasets: [
          {
            label: 'Problem / Issue Count',
            data: sectionCounts.values,
            backgroundColor: this.getColors(sectionCounts.labels.length),
            borderColor: this.getColors(sectionCounts.labels.length),
            borderWidth: 1,
            borderRadius: 8
          }
        ]
      },
      options: this.getBarChartOptions()
    });

    this.responsibleBarChart = new Chart(this.responsibleBarCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: responsibleCounts.labels,
        datasets: [
          {
            label: 'Problem / Issue Count',
            data: responsibleCounts.values,
            backgroundColor: this.getColors(responsibleCounts.labels.length),
            borderColor: this.getColors(responsibleCounts.labels.length),
            borderWidth: 1,
            borderRadius: 8
          }
        ]
      },
      options: this.getBarChartOptions()
    });
  }

  private updateCharts(data: MaintenanceIssue[]): void {
    const statusCounts = this.countByField(data, 'status');
    const sectionCounts = this.countByField(data, 'section');
    const responsibleCounts = this.countByField(data, 'responsiblePerson');

    if (this.statusPieChart) {
      this.statusPieChart.data.labels = statusCounts.labels;
      this.statusPieChart.data.datasets[0].data = statusCounts.values;
      this.statusPieChart.data.datasets[0].backgroundColor = this.getStatusColors(statusCounts.labels);
      this.statusPieChart.update();
    }

    if (this.sectionBarChart) {
      this.sectionBarChart.data.labels = sectionCounts.labels;
      this.sectionBarChart.data.datasets[0].data = sectionCounts.values;
      this.sectionBarChart.data.datasets[0].backgroundColor = this.getColors(sectionCounts.labels.length);
      this.sectionBarChart.data.datasets[0].borderColor = this.getColors(sectionCounts.labels.length);
      this.sectionBarChart.update();
    }

    if (this.responsibleBarChart) {
      this.responsibleBarChart.data.labels = responsibleCounts.labels;
      this.responsibleBarChart.data.datasets[0].data = responsibleCounts.values;
      this.responsibleBarChart.data.datasets[0].backgroundColor = this.getColors(responsibleCounts.labels.length);
      this.responsibleBarChart.data.datasets[0].borderColor = this.getColors(responsibleCounts.labels.length);
      this.responsibleBarChart.update();
    }
  }

  private countByField(
    data: MaintenanceIssue[],
    field: keyof MaintenanceIssue
  ): { labels: string[]; values: number[] } {
    const counts: Record<string, number> = {};

    data.forEach(issue => {
      const value = issue[field];
      const key = String(value || 'Unknown').trim() || 'Unknown';

      counts[key] = (counts[key] || 0) + 1;
    });

    return {
      labels: Object.keys(counts),
      values: Object.values(counts)
    };
  }

  private getColors(count: number): string[] {
    return Array.from({ length: count }, (_, index) => {
      return this.chartColors[index % this.chartColors.length];
    });
  }

  private getStatusColors(labels: string[]): string[] {
    const statusColorMap: Record<string, string> = {
      Open: '#ef4444',
      'In Progress': '#f59e0b',
      Closed: '#22c55e',
      Overdue: '#991b1b',
      Completed: '#22c55e',
      New: '#2563eb',
      'Not started': '#64748b',
      Cancelled: '#6b7280'
    };

    return labels.map(label => statusColorMap[label] || '#64748b');
  }

  private getPieChartOptions(): ChartConfiguration<'pie'>['options'] {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 14,
            padding: 16
          }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = context.label || '';
              const value = context.parsed || 0;
              return `${label}: ${value}`;
            }
          }
        }
      }
    };
  }

  private getBarChartOptions(): ChartConfiguration<'bar'>['options'] {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              return `Count: ${context.parsed.y}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            autoSkip: false,
            maxRotation: 45,
            minRotation: 0
          },
          grid: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      }
    };
  }

  async exportToExcel(): Promise<void> {
    const exportData = this.chartSourceIssues.length > 0
      ? this.chartSourceIssues
      : this.issues;

    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'Asset IQ';
    workbook.created = new Date();

    const tableSheet = workbook.addWorksheet('Action Tracker Table');
    const chartsSheet = workbook.addWorksheet('Charts');

    this.buildTableWorksheet(tableSheet, exportData);
    this.buildChartsWorksheet(workbook, chartsSheet);

    const fileName = `Action_Tracker_${new Date().toISOString().slice(0, 10)}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();

    saveAs(
      new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }),
      fileName
    );
  }

  private buildTableWorksheet(
    worksheet: ExcelJS.Worksheet,
    data: MaintenanceIssue[]
  ): void {
    worksheet.columns = [
      { header: 'Responsible Person', key: 'responsiblePerson', width: 28 },
      { header: 'Section', key: 'section', width: 22 },
      { header: 'Equipment', key: 'equipment', width: 22 },
      { header: 'Problem / Issue', key: 'problemIssue', width: 40 },
      { header: 'Comments', key: 'comments', width: 45 },
      { header: 'Due Date', key: 'dueDate', width: 18 },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Criticality', key: 'criticality', width: 18 },
      { header: 'Source', key: 'source', width: 22 },
      { header: 'Cause', key: 'cause', width: 35 },
      { header: 'Action', key: 'action', width: 40 },
      { header: 'Plant Stoppage Required', key: 'totalPlantStoppageRequired', width: 24 },
      { header: 'Time Required Hours', key: 'timeRequiredHours', width: 20 }
    ];

    data.forEach(issue => {
      worksheet.addRow({
        responsiblePerson: issue.responsiblePerson || '',
        section: issue.section || '',
        equipment: issue.equipment || '',
        problemIssue: issue.problemIssue || '',
        comments: issue.comments || '',
        dueDate: issue.dueDate ? new Date(issue.dueDate) : '',
        status: issue.status || '',
        criticality: issue.criticality || '',
        source: issue.source || '',
        cause: issue.cause || '',
        action: issue.action || '',
        totalPlantStoppageRequired: issue.totalPlantStoppageRequired ? 'Yes' : 'No',
        timeRequiredHours: issue.timeRequiredHours ?? 0
      });
    });

    worksheet.getRow(1).font = {
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };

    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' }
    };

    worksheet.getRow(1).alignment = {
      vertical: 'middle',
      horizontal: 'center'
    };

    worksheet.getRow(1).height = 24;

    worksheet.eachRow((row, rowNumber) => {
      row.eachCell(cell => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        cell.alignment = {
          vertical: 'top',
          wrapText: true
        };

        if (rowNumber > 1) {
          cell.font = {
            color: { argb: 'FF334155' }
          };
        }
      });
    });

    worksheet.getColumn('F').numFmt = 'dd mmm yyyy';

    worksheet.autoFilter = {
      from: 'A1',
      to: 'M1'
    };

    worksheet.views = [
      {
        state: 'frozen',
        ySplit: 1
      }
    ];
  }

  private buildChartsWorksheet(
    workbook: ExcelJS.Workbook,
    worksheet: ExcelJS.Worksheet
  ): void {
    worksheet.columns = [
      { width: 4 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 }
    ];

    worksheet.getCell('B2').value = 'Action Tracker Charts';
    worksheet.getCell('B2').font = {
      bold: true,
      size: 18,
      color: { argb: 'FF0F172A' }
    };

    worksheet.getCell('B3').value = `Exported on ${new Date().toLocaleString()}`;
    worksheet.getCell('B3').font = {
      size: 11,
      color: { argb: 'FF64748B' }
    };

    worksheet.getCell('B5').value = 'Count of Problem / Issue by Status';
    worksheet.getCell('B5').font = {
      bold: true,
      size: 13,
      color: { argb: 'FF0F172A' }
    };

    worksheet.getCell('H5').value = 'Count of Problem / Issue per Section';
    worksheet.getCell('H5').font = {
      bold: true,
      size: 13,
      color: { argb: 'FF0F172A' }
    };

    worksheet.getCell('B28').value = 'Count of Problem / Issue by Responsible Person';
    worksheet.getCell('B28').font = {
      bold: true,
      size: 13,
      color: { argb: 'FF0F172A' }
    };

    const statusImage = this.getCanvasImageBase64(this.statusPieCanvas);
    const sectionImage = this.getCanvasImageBase64(this.sectionBarCanvas);
    const responsibleImage = this.getCanvasImageBase64(this.responsibleBarCanvas);

    if (statusImage) {
      const imageId = workbook.addImage({
        base64: statusImage,
        extension: 'png'
      });

      worksheet.addImage(imageId, {
        tl: { col: 1, row: 6 },
        ext: { width: 520, height: 320 }
      });
    }

    if (sectionImage) {
      const imageId = workbook.addImage({
        base64: sectionImage,
        extension: 'png'
      });

      worksheet.addImage(imageId, {
        tl: { col: 7, row: 6 },
        ext: { width: 620, height: 320 }
      });
    }

    if (responsibleImage) {
      const imageId = workbook.addImage({
        base64: responsibleImage,
        extension: 'png'
      });

      worksheet.addImage(imageId, {
        tl: { col: 1, row: 29 },
        ext: { width: 900, height: 360 }
      });
    }
  }

  private getCanvasImageBase64(
    canvasRef: ElementRef<HTMLCanvasElement> | undefined
  ): string | null {
    if (!canvasRef?.nativeElement) {
      return null;
    }

    return canvasRef.nativeElement.toDataURL('image/png');
  }
}