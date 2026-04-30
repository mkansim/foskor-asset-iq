import {
  AfterViewInit,
  ChangeDetectorRef,
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
  @ViewChild('sectionBarCanvas') sectionBarCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('departmentBarCanvas') departmentBarCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('reasonBarCanvas') reasonBarCanvas!: ElementRef<HTMLCanvasElement>;

  downtimeReports: DowntimeReport[] = [];
  filteredReports: DowntimeReport[] = [];

  private chartSourceReports: DowntimeReport[] = [];

  importedFileName = '';
  searchText = '';

  selectedStopDate = '';
  selectedStartDate = '';

  currentPage = 1;
  pageSize = 10;
  totalItems = 0;
  totalPages = 1;

  sortColumn: keyof DowntimeReport | '' = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  private sectionBarChart?: Chart<'bar'>;
  private departmentBarChart?: Chart<'bar'>;
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

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.rebuildCharts([]);
  }

  ngOnDestroy(): void {
    this.destroyCharts();
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
        cellDates: false,
        cellFormula: true,
        cellNF: true,
        cellText: true
      });

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, {
        header: 1,
        defval: '',
        raw: true
      });

      const headerRowIndex = this.findHeaderRowIndex(rows);

      if (headerRowIndex === -1) {
        console.error('Could not find downtime report header row.');

        this.downtimeReports = [];
        this.filteredReports = [];
        this.chartSourceReports = [];
        this.totalItems = 0;
        this.totalPages = 1;

        this.rebuildCharts([]);

        input.value = '';
        return;
      }

      const headerMap = this.createHeaderMap(rows[headerRowIndex]);

      const importedReports = rows
        .slice(headerRowIndex + 1)
        .map((row, index) => {
          const excelRowIndex = headerRowIndex + 1 + index;

          return this.mapExcelRowToDowntimeReport(
            row,
            index,
            worksheet,
            excelRowIndex,
            headerMap
          );
        })
        .filter(report =>
          report.section ||
          report.department ||
          report.equipment ||
          report.cause ||
          report.reason
        );

      this.downtimeReports = importedReports;
      this.currentPage = 1;
      this.searchText = '';
      this.selectedStopDate = '';
      this.selectedStartDate = '';

      this.applyFilters();

      input.value = '';
    };

    reader.readAsArrayBuffer(file);
  }

  private findHeaderRowIndex(rows: any[][]): number {
    return rows.findIndex(row => {
      const normalized = row.map(cell => this.normalizeHeader(cell));

      return (
        normalized.includes('section') &&
        normalized.includes('department') &&
        normalized.includes('equipment')
      );
    });
  }

  private createHeaderMap(headerRow: any[]): Record<string, number> {
    const map: Record<string, number> = {};

    headerRow.forEach((header, index) => {
      const key = this.normalizeHeader(header);

      if (key) {
        map[key] = index;
      }
    });

    return map;
  }

  private normalizeHeader(value: any): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[\/_.-]/g, '');
  }

  private getColumnIndex(
    headerMap: Record<string, number>,
    possibleHeaders: string[],
    fallbackIndex: number
  ): number {
    for (const header of possibleHeaders) {
      const key = this.normalizeHeader(header);

      if (headerMap[key] !== undefined) {
        return headerMap[key];
      }
    }

    return fallbackIndex;
  }

  private mapExcelRowToDowntimeReport(
    row: any[],
    index: number,
    worksheet: XLSX.WorkSheet,
    excelRowIndex: number,
    headerMap: Record<string, number>
  ): DowntimeReport {
    const sectionIndex = this.getColumnIndex(headerMap, ['Section'], 0);
    const departmentIndex = this.getColumnIndex(headerMap, ['Department'], 1);
    const equipmentIndex = this.getColumnIndex(headerMap, ['Equipment'], 2);
    const causeIndex = this.getColumnIndex(headerMap, ['Cause'], 3);

    const reasonIndex = this.getColumnIndex(
      headerMap,
      ['Reason', 'Remark', 'Reason/Remark', 'Reason Remark'],
      4
    );

    const stopDateIndex = this.getColumnIndex(
      headerMap,
      ['StopDate', 'Stop Date'],
      5
    );

    const startDateIndex = this.getColumnIndex(
      headerMap,
      ['StartDate', 'Start Date'],
      6
    );

    const downtimeHoursIndex = this.getColumnIndex(
      headerMap,
      [
        'Downtime hours',
        'Downtime Hours',
        'DowntimeHours',
        'Down time hours',
        'DownTimeHours',
        'Hours'
      ],
      -1
    );

    const stopDate = this.parseExcelDate(row[stopDateIndex]);
    const startDate = this.parseExcelDate(row[startDateIndex]);

    let downtimeHours = this.getDowntimeHoursFromWorksheet(
      worksheet,
      excelRowIndex,
      downtimeHoursIndex
    );

    if (downtimeHours === 0 && stopDate && startDate) {
      downtimeHours = this.calculateDowntimeHours(stopDate, startDate);
    }

    return {
      id: index + 1,
      section: this.cleanString(row[sectionIndex]),
      department: this.cleanString(row[departmentIndex]),
      equipment: this.cleanString(row[equipmentIndex]),
      cause: this.cleanString(row[causeIndex]),
      reason: this.cleanString(row[reasonIndex]),
      stopDate,
      startDate,
      downtimeHours
    };
  }

  private getDowntimeHoursFromWorksheet(
    worksheet: XLSX.WorkSheet,
    zeroBasedRowIndex: number,
    downtimeHoursIndex: number
  ): number {
    /*
      Prefer the column found by the "Downtime hours" header.
      If not found, fallback to column AA.
    */
    const columnIndex = downtimeHoursIndex >= 0
      ? downtimeHoursIndex
      : XLSX.utils.decode_col('AA');

    const cellAddress = XLSX.utils.encode_cell({
      r: zeroBasedRowIndex,
      c: columnIndex
    });

    const cell = worksheet[cellAddress];

    if (!cell) {
      return 0;
    }

    return this.parseDowntimeHoursCell(cell);
  }

  private parseDowntimeHoursCell(cell: XLSX.CellObject): number {
    const rawValue = cell.v;
    const formattedValue = cell.w;
    const numberFormat = String(cell.z || '').toLowerCase();

    /*
      Excel duration display examples:
      "24:00"
      "12:30"
      "1:15:00"
    */
    if (formattedValue && String(formattedValue).includes(':')) {
      const durationHours = this.parseDurationTextToHours(String(formattedValue));

      if (durationHours > 0) {
        return durationHours;
      }
    }

    /*
      Text examples:
      "24"
      "24 hrs"
      "24 hours"
    */
    if (formattedValue) {
      const parsedFormatted = this.parseNumber(formattedValue);

      if (parsedFormatted > 0 && !String(formattedValue).includes(':')) {
        return parsedFormatted;
      }
    }

    /*
      Excel may store duration as a fraction of a day:
      1      = 24 hours
      0.5    = 12 hours
      0.0417 = 1 hour

      Only multiply by 24 if the cell format looks like a duration/time format.
    */
    if (typeof rawValue === 'number') {
      const looksLikeDuration =
        numberFormat.includes('[h]') ||
        numberFormat.includes('h:mm') ||
        numberFormat.includes('hh:mm') ||
        numberFormat.includes(':');

      if (looksLikeDuration) {
        return Number((rawValue * 24).toFixed(2));
      }

      return Number(rawValue.toFixed(2));
    }

    return this.parseNumber(rawValue);
  }

  private parseDurationTextToHours(value: string): number {
    const cleanValue = value.trim();

    const parts = cleanValue.split(':').map(part => Number(part));

    if (parts.some(part => Number.isNaN(part))) {
      return 0;
    }

    if (parts.length === 2) {
      const [hours, minutes] = parts;

      return Number((hours + minutes / 60).toFixed(2));
    }

    if (parts.length === 3) {
      const [hours, minutes, seconds] = parts;

      return Number((hours + minutes / 60 + seconds / 3600).toFixed(2));
    }

    return 0;
  }

  private parseExcelDate(value: any): Date | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    if (value instanceof Date && !isNaN(value.getTime())) {
      return this.toLocalDate(value);
    }

    if (typeof value === 'number') {
      const parsed = XLSX.SSF.parse_date_code(value);

      if (!parsed) {
        return null;
      }

      return new Date(
        parsed.y,
        parsed.m - 1,
        parsed.d,
        parsed.H || 0,
        parsed.M || 0,
        parsed.S || 0
      );
    }

    const text = String(value).trim();

    if (!text) {
      return null;
    }

    const isoDateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (isoDateOnly) {
      return new Date(
        Number(isoDateOnly[1]),
        Number(isoDateOnly[2]) - 1,
        Number(isoDateOnly[3]),
        0,
        0,
        0
      );
    }

    const ddMmYyyy = text.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );

    if (ddMmYyyy) {
      return new Date(
        Number(ddMmYyyy[3]),
        Number(ddMmYyyy[2]) - 1,
        Number(ddMmYyyy[1]),
        Number(ddMmYyyy[4] || 0),
        Number(ddMmYyyy[5] || 0),
        Number(ddMmYyyy[6] || 0)
      );
    }

    const parsedDate = new Date(text);

    if (!isNaN(parsedDate.getTime())) {
      return this.toLocalDate(parsedDate);
    }

    return null;
  }

  private toLocalDate(date: Date): Date {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds()
    );
  }

  private calculateDowntimeHours(stopDate: Date, startDate: Date): number {
    const milliseconds = startDate.getTime() - stopDate.getTime();

    if (milliseconds <= 0) {
      return 0;
    }

    return Number((milliseconds / 1000 / 60 / 60).toFixed(2));
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

    if (typeof value === 'number') {
      return Number.isFinite(value) ? Number(value.toFixed(2)) : 0;
    }

    const cleanedValue = String(value)
      .trim()
      .replace(/\s/g, '')
      .replace(',', '.')
      .replace(/[^\d.-]/g, '');

    if (!cleanedValue) {
      return 0;
    }

    const parsed = Number(cleanedValue);

    return Number.isNaN(parsed) ? 0 : Number(parsed.toFixed(2));
  }

  onSearch(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  onDateRangeFilterChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  clearDateRangeFilter(): void {
    this.selectedStopDate = '';
    this.selectedStartDate = '';
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

    const filterStopDate = this.selectedStopDate
      ? this.getDateInputStart(this.selectedStopDate)
      : null;

    const filterStartDate = this.selectedStartDate
      ? this.getDateInputEnd(this.selectedStartDate)
      : null;

    if (filterStopDate || filterStartDate) {
      results = results.filter(item => {
        const rowStopDate = item.stopDate;
        const rowStartDate = item.startDate;

        if (!rowStopDate && !rowStartDate) {
          return false;
        }

        const rowFrom = rowStopDate || rowStartDate;
        const rowTo = rowStartDate || rowStopDate;

        if (!rowFrom || !rowTo) {
          return false;
        }

        if (filterStopDate && rowTo < filterStopDate) {
          return false;
        }

        if (filterStartDate && rowFrom > filterStartDate) {
          return false;
        }

        return true;
      });
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

    this.cdr.detectChanges();
    this.rebuildCharts(results);
  }

  private getDateInputStart(dateText: string): Date {
    const [year, month, day] = dateText.split('-').map(Number);

    return new Date(year, month - 1, day, 0, 0, 0);
  }

  private getDateInputEnd(dateText: string): Date {
    const [year, month, day] = dateText.split('-').map(Number);

    return new Date(year, month - 1, day, 23, 59, 59);
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

  private rebuildCharts(data: DowntimeReport[]): void {
    this.destroyCharts();

    if (
      !this.sectionBarCanvas?.nativeElement ||
      !this.departmentBarCanvas?.nativeElement ||
      !this.reasonBarCanvas?.nativeElement
    ) {
      return;
    }

    const sectionSums = this.sumHoursByField(data, 'section');
    const departmentSums = this.sumHoursByField(data, 'department');
    const reasonSums = this.sumHoursByField(data, 'reason');

    this.sectionBarChart = new Chart(this.sectionBarCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: sectionSums.labels,
        datasets: [
          {
            label: 'Total Downtime Hours',
            data: sectionSums.values,
            backgroundColor: this.getColors(sectionSums.labels.length),
            borderColor: this.getColors(sectionSums.labels.length),
            borderWidth: 1,
            borderRadius: 8
          }
        ]
      },
      options: this.getHoursBarChartOptions()
    });

    this.departmentBarChart = new Chart(this.departmentBarCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: departmentSums.labels,
        datasets: [
          {
            label: 'Total Downtime Hours',
            data: departmentSums.values,
            backgroundColor: this.getColors(departmentSums.labels.length),
            borderColor: this.getColors(departmentSums.labels.length),
            borderWidth: 1,
            borderRadius: 8
          }
        ]
      },
      options: this.getHoursBarChartOptions()
    });

    this.reasonBarChart = new Chart(this.reasonBarCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: reasonSums.labels,
        datasets: [
          {
            label: 'Total Downtime Hours',
            data: reasonSums.values,
            backgroundColor: this.getColors(reasonSums.labels.length),
            borderColor: this.getColors(reasonSums.labels.length),
            borderWidth: 1,
            borderRadius: 8
          }
        ]
      },
      options: this.getHoursBarChartOptions()
    });
  }

  private destroyCharts(): void {
    this.sectionBarChart?.destroy();
    this.departmentBarChart?.destroy();
    this.reasonBarChart?.destroy();

    this.sectionBarChart = undefined;
    this.departmentBarChart = undefined;
    this.reasonBarChart = undefined;
  }

  private sumHoursByField(
    data: DowntimeReport[],
    field: keyof DowntimeReport
  ): { labels: string[]; values: number[] } {
    const sums: Record<string, number> = {};

    data.forEach(item => {
      const label = String(item[field] || 'Unknown').trim() || 'Unknown';
      const hours = Number(item.downtimeHours) || 0;

      sums[label] = (sums[label] || 0) + hours;
    });

    const sortedEntries = Object.entries(sums)
      .sort((a, b) => b[1] - a[1]);

    return {
      labels: sortedEntries.map(([label]) => label),
      values: sortedEntries.map(([, value]) => Number(value.toFixed(2)))
    };
  }

  private getColors(count: number): string[] {
    return Array.from({ length: count }, (_, index) => {
      return this.chartColors[index % this.chartColors.length];
    });
  }

  private getHoursBarChartOptions(): ChartConfiguration<'bar'>['options'] {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const value = Number(context.parsed.y || 0).toFixed(2);
              return `Hours: ${value}`;
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
          title: {
            display: true,
            text: 'Total Downtime Hours'
          },
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
      { header: 'Reason / Remark', key: 'reason', width: 40 },
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
        stopDate: item.stopDate || '',
        startDate: item.startDate || '',
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

    worksheet.getCell('B5').value = 'Sum of Downtime Hours by Section';
    worksheet.getCell('B5').font = {
      bold: true,
      size: 13,
      color: { argb: 'FF0F172A' }
    };

    worksheet.getCell('H5').value = 'Sum of Downtime Hours by Department';
    worksheet.getCell('H5').font = {
      bold: true,
      size: 13,
      color: { argb: 'FF0F172A' }
    };

    worksheet.getCell('B28').value = 'Sum of Downtime Hours by Reason / Remark';
    worksheet.getCell('B28').font = {
      bold: true,
      size: 13,
      color: { argb: 'FF0F172A' }
    };

    const sectionImage = this.getCanvasImageBase64(this.sectionBarCanvas);
    const departmentImage = this.getCanvasImageBase64(this.departmentBarCanvas);
    const reasonImage = this.getCanvasImageBase64(this.reasonBarCanvas);

    if (sectionImage) {
      const imageId = workbook.addImage({
        base64: sectionImage,
        extension: 'png'
      });

      worksheet.addImage(imageId, {
        tl: { col: 1, row: 6 },
        ext: { width: 560, height: 320 }
      });
    }

    if (departmentImage) {
      const imageId = workbook.addImage({
        base64: departmentImage,
        extension: 'png'
      });

      worksheet.addImage(imageId, {
        tl: { col: 7, row: 6 },
        ext: { width: 560, height: 320 }
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

  private debugDowntimeCell(
    worksheet: XLSX.WorkSheet,
    zeroBasedRowIndex: number,
    columnIndex: number
  ): void {
    const cellAddress = XLSX.utils.encode_cell({
      r: zeroBasedRowIndex,
      c: columnIndex
    });

    const cell = worksheet[cellAddress];

    console.log('Downtime cell debug:', {
      cellAddress,
      cell
    });
  }
}