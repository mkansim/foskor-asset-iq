import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  Chart,
  ChartConfiguration,
  registerables
} from 'chart.js';

import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

import { DowntimeReport } from '../../models/downtime-report.model';

Chart.register(...registerables);

@Component({
  selector: 'app-downtime-report',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './downtime-report.component.html',
  styleUrls: ['./downtime-report.component.scss']
})
export class DowntimeReportComponent implements AfterViewInit, OnDestroy {
  @ViewChild('sectionPieCanvas') sectionPieCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('departmentPieCanvas') departmentPieCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('reasonBarCanvas') reasonBarCanvas!: ElementRef<HTMLCanvasElement>;

  downtimeReports: DowntimeReport[] = [];
  filteredReports: DowntimeReport[] = [];

  private chartSourceReports: DowntimeReport[] = [];

  importedFileName = '';
  searchText = '';

  currentPage = 1;
  pageSize = 10;
  totalItems = 0;
  totalPages = 1;

  sortColumn: keyof DowntimeReport | '' = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  private sectionPieChart?: Chart<'pie'>;
  private departmentPieChart?: Chart<'pie'>;
  private reasonBarChart?: Chart<'bar'>;

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
    '#65a30d',
    '#f43f5e',
    '#0ea5e9'
  ];

  ngAfterViewInit(): void {
    this.createCharts();
    this.updateCharts([]);
  }

  ngOnDestroy(): void {
    this.sectionPieChart?.destroy();
    this.departmentPieChart?.destroy();
    this.reasonBarChart?.destroy();
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

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
        defval: '',
        raw: false
      });

      const importedReports = rows
        .map((row, index) => this.mapExcelRowToDowntimeReport(row, index))
        .filter(report =>
          report.section ||
          report.department ||
          report.equipment ||
          report.reason
        );

      this.downtimeReports = importedReports;
      this.currentPage = 1;
      this.searchText = '';

      this.applyFilters();

      input.value = '';
    };

    reader.readAsArrayBuffer(file);
  }

  private mapExcelRowToDowntimeReport(
    row: Record<string, any>,
    index: number
  ): DowntimeReport {
    const stopDateValue = this.getExcelValue(row, [
      'StopDate',
      'Stop Date',
      'Stop date'
    ]);

    const startDateValue = this.getExcelValue(row, [
      'StartDate',
      'Start Date',
      'Start date'
    ]);

    const downtimeHoursValue = this.getExcelColumnValue(row, 'AA');

    return {
      id: index + 1,
      section: this.cleanString(this.getExcelValue(row, ['Section'])),
      department: this.cleanString(this.getExcelValue(row, ['Department'])),
      equipment: this.cleanString(this.getExcelValue(row, ['Equipment'])),
      cause: this.cleanString(this.getExcelValue(row, ['Cause'])),
      reason: this.cleanString(this.getExcelValue(row, ['Reason'])),
      stopDate: this.parseExcelDate(stopDateValue),
      startDate: this.parseExcelDate(startDateValue),
      downtimeHours: this.parseNumber(downtimeHoursValue)
    };
  }

  private getExcelColumnValue(row: Record<string, any>, columnLetter: string): any {
    const keys = Object.keys(row);

    const columnIndex = XLSX.utils.decode_col(columnLetter);

    if (keys[columnIndex] !== undefined) {
      return row[keys[columnIndex]];
    }

    return '';
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
        return new Date(
          parsed.y,
          parsed.m - 1,
          parsed.d,
          parsed.H || 0,
          parsed.M || 0,
          parsed.S || 0
        );
      }
    }

    const text = String(value).trim();

    const dateTimeMatch = text.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/
    );

    if (dateTimeMatch) {
      const day = Number(dateTimeMatch[1]);
      const month = Number(dateTimeMatch[2]);
      const year = Number(dateTimeMatch[3]);
      const hour = Number(dateTimeMatch[4] || 0);
      const minute = Number(dateTimeMatch[5] || 0);

      return new Date(year, month - 1, day, hour, minute);
    }

    const parsedDate = new Date(text);

    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }

    return new Date();
  }

  onSearch(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  applyFilters(): void {
    let results = [...this.downtimeReports];

    const search = this.searchText.trim().toLowerCase();

    if (search) {
      results = results.filter(item =>
        item.section?.toLowerCase().includes(search) ||
        item.department?.toLowerCase().includes(search) ||
        item.equipment?.toLowerCase().includes(search) ||
        item.cause?.toLowerCase().includes(search) ||
        item.reason?.toLowerCase().includes(search)
      );
    }

    if (this.sortColumn) {
      results = this.sortReports(results);
    }

    this.chartSourceReports = results;

    this.totalItems = results.length;
    this.totalPages = Math.ceil(this.totalItems / this.pageSize) || 1;

    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }

    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;

    this.filteredReports = results.slice(startIndex, endIndex);

    this.updateCharts(results);
  }

  onSort(column: keyof DowntimeReport): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.applyFilters();
  }

  getSortIcon(column: keyof DowntimeReport): string {
    if (this.sortColumn !== column) {
      return '↕';
    }

    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

  private sortReports(data: DowntimeReport[]): DowntimeReport[] {
    return data.sort((a, b) => {
      const valueA = a[this.sortColumn as keyof DowntimeReport];
      const valueB = b[this.sortColumn as keyof DowntimeReport];

      let comparison = 0;

      if (valueA instanceof Date && valueB instanceof Date) {
        comparison = valueA.getTime() - valueB.getTime();
      } else if (typeof valueA === 'number' && typeof valueB === 'number') {
        comparison = valueA - valueB;
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

  private createCharts(): void {
    if (
      !this.sectionPieCanvas ||
      !this.departmentPieCanvas ||
      !this.reasonBarCanvas
    ) {
      return;
    }

    const sectionCounts = this.countByField(this.chartSourceReports, 'section');
    const departmentCounts = this.countByField(this.chartSourceReports, 'department');
    const reasonCounts = this.countByField(this.chartSourceReports, 'reason');

    this.sectionPieChart = new Chart(this.sectionPieCanvas.nativeElement, {
      type: 'pie',
      data: {
        labels: sectionCounts.labels,
        datasets: [
          {
            data: sectionCounts.values,
            backgroundColor: this.getColors(sectionCounts.labels.length),
            borderColor: '#ffffff',
            borderWidth: 2
          }
        ]
      },
      options: this.getPieChartOptions()
    });

    this.departmentPieChart = new Chart(this.departmentPieCanvas.nativeElement, {
      type: 'pie',
      data: {
        labels: departmentCounts.labels,
        datasets: [
          {
            data: departmentCounts.values,
            backgroundColor: this.getColors(departmentCounts.labels.length),
            borderColor: '#ffffff',
            borderWidth: 2
          }
        ]
      },
      options: this.getPieChartOptions()
    });

    this.reasonBarChart = new Chart(this.reasonBarCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: reasonCounts.labels,
        datasets: [
          {
            label: 'Downtime Count',
            data: reasonCounts.values,
            backgroundColor: this.getColors(reasonCounts.labels.length),
            borderColor: this.getColors(reasonCounts.labels.length),
            borderWidth: 1,
            borderRadius: 8
          }
        ]
      },
      options: this.getBarChartOptions()
    });
  }

  private updateCharts(data: DowntimeReport[]): void {
    const sectionCounts = this.countByField(data, 'section');
    const departmentCounts = this.countByField(data, 'department');
    const reasonCounts = this.countByField(data, 'reason');

    if (this.sectionPieChart) {
      this.sectionPieChart.data.labels = sectionCounts.labels;
      this.sectionPieChart.data.datasets[0].data = sectionCounts.values;
      this.sectionPieChart.data.datasets[0].backgroundColor = this.getColors(sectionCounts.labels.length);
      this.sectionPieChart.update();
    }

    if (this.departmentPieChart) {
      this.departmentPieChart.data.labels = departmentCounts.labels;
      this.departmentPieChart.data.datasets[0].data = departmentCounts.values;
      this.departmentPieChart.data.datasets[0].backgroundColor = this.getColors(departmentCounts.labels.length);
      this.departmentPieChart.update();
    }

    if (this.reasonBarChart) {
      this.reasonBarChart.data.labels = reasonCounts.labels;
      this.reasonBarChart.data.datasets[0].data = reasonCounts.values;
      this.reasonBarChart.data.datasets[0].backgroundColor = this.getColors(reasonCounts.labels.length);
      this.reasonBarChart.data.datasets[0].borderColor = this.getColors(reasonCounts.labels.length);
      this.reasonBarChart.update();
    }
  }

  private countByField(
    data: DowntimeReport[],
    field: keyof DowntimeReport
  ): { labels: string[]; values: number[] } {
    const counts: Record<string, number> = {};

    data.forEach(item => {
      const value = item[field];
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
    const exportData = this.chartSourceReports.length > 0
      ? this.chartSourceReports
      : this.downtimeReports;

    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'Asset IQ';
    workbook.created = new Date();

    const reportSheet = workbook.addWorksheet('Downtime Report');
    const chartsSheet = workbook.addWorksheet('Charts');

    this.buildReportWorksheet(reportSheet, exportData);
    this.buildChartsWorksheet(workbook, chartsSheet);

    const fileName = `Downtime_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();

    saveAs(
      new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }),
      fileName
    );
  }

  private buildReportWorksheet(
    worksheet: ExcelJS.Worksheet,
    data: DowntimeReport[]
  ): void {
    worksheet.columns = [
      { header: 'Section', key: 'section', width: 24 },
      { header: 'Department', key: 'department', width: 24 },
      { header: 'Equipment', key: 'equipment', width: 24 },
      { header: 'Cause', key: 'cause', width: 35 },
      { header: 'Reason', key: 'reason', width: 40 },
      { header: 'StopDate', key: 'stopDate', width: 22 },
      { header: 'StartDate', key: 'startDate', width: 22 },
      { header: 'Downtime hours', key: 'downtimeHours', width: 18 }
    ];

    data.forEach(item => {
      worksheet.addRow({
        section: item.section || '',
        department: item.department || '',
        equipment: item.equipment || '',
        cause: item.cause || '',
        reason: item.reason || '',
        stopDate: item.stopDate ? new Date(item.stopDate) : '',
        startDate: item.startDate ? new Date(item.startDate) : '',
        downtimeHours: item.downtimeHours ?? 0
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

    worksheet.getColumn('F').numFmt = 'dd mmm yyyy hh:mm';
    worksheet.getColumn('G').numFmt = 'dd mmm yyyy hh:mm';
    worksheet.getColumn('H').numFmt = '0.00';

    worksheet.autoFilter = {
      from: 'A1',
      to: 'H1'
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

    worksheet.getCell('B2').value = 'Downtime Report Charts';
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

    worksheet.getCell('B5').value = 'Downtime by Section';
    worksheet.getCell('B5').font = {
      bold: true,
      size: 13,
      color: { argb: 'FF0F172A' }
    };

    worksheet.getCell('H5').value = 'Downtime by Department';
    worksheet.getCell('H5').font = {
      bold: true,
      size: 13,
      color: { argb: 'FF0F172A' }
    };

    worksheet.getCell('B28').value = 'Downtime by Reason';
    worksheet.getCell('B28').font = {
      bold: true,
      size: 13,
      color: { argb: 'FF0F172A' }
    };

    const sectionImage = this.getCanvasImageBase64(this.sectionPieCanvas);
    const departmentImage = this.getCanvasImageBase64(this.departmentPieCanvas);
    const reasonImage = this.getCanvasImageBase64(this.reasonBarCanvas);

    if (sectionImage) {
      const imageId = workbook.addImage({
        base64: sectionImage,
        extension: 'png'
      });

      worksheet.addImage(imageId, {
        tl: { col: 1, row: 6 },
        ext: { width: 520, height: 320 }
      });
    }

    if (departmentImage) {
      const imageId = workbook.addImage({
        base64: departmentImage,
        extension: 'png'
      });

      worksheet.addImage(imageId, {
        tl: { col: 7, row: 6 },
        ext: { width: 520, height: 320 }
      });
    }

    if (reasonImage) {
      const imageId = workbook.addImage({
        base64: reasonImage,
        extension: 'png'
      });

      worksheet.addImage(imageId, {
        tl: { col: 1, row: 29 },
        ext: { width: 980, height: 360 }
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