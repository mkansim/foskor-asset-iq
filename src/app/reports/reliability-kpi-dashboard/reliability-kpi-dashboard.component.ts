import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  Chart,
  ChartConfiguration,
  ChartData,
  registerables
} from 'chart.js';

import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

import { ReliabilityKpiService } from '../../services/reliability-kpi.service';
import { ActionTrackerService } from '../../services/action-tracker.service';

import { ReliabilityKpi, KpiSummary } from '../../models/reliability-kpi.model';
import { ActionTracker } from '../../models/action-tracker.model';

Chart.register(...registerables);

type DashboardSection =
  | 'performance'
  | 'trend'
  | 'latest'
  | 'resources'
  | 'records'
  | 'tracker';

@Component({
  selector: 'app-reliability-kpi-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DecimalPipe,
    DatePipe
  ],
  templateUrl: './reliability-kpi-dashboard.component.html',
  styleUrl: './reliability-kpi-dashboard.component.scss'
})
export class ReliabilityKpiDashboardComponent
  implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('kpiTrendChart') kpiTrendChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('kpiStatusChart') kpiStatusChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('backlogChart') backlogChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('resourceChart') resourceChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('actionStatusChart') actionStatusChartRef!: ElementRef<HTMLCanvasElement>;

  selectedDepartment = 'Mechanical Workshop';
  selectedActionStatus = '';

  activeSection: DashboardSection = 'performance';

  departments: string[] = [
    'Mechanical Workshop',
    'Electrical Workshop'
  ];

  actionStatuses: string[] = [
    '',
    'Complete',
    'In-Progress',
    'Not Started',
    'Overdue',
    'New Action'
  ];

  summary?: KpiSummary;

  kpiTrend: ReliabilityKpi[] = [];
  filteredKpiTrend: ReliabilityKpi[] = [];

  actions: ActionTracker[] = [];
  filteredActions: ActionTracker[] = [];

  availableWeeks: string[] = [];
  fromWeek = '';
  toWeek = '';
  weekFilterError = '';

  loading = false;
  errorMessage = '';

  private viewReady = false;

  private kpiTrendChart?: Chart;
  private kpiStatusChart?: Chart;
  private backlogChart?: Chart;
  private resourceChart?: Chart;
  private actionStatusChart?: Chart;

  constructor(
    private reliabilityKpiService: ReliabilityKpiService,
    private actionTrackerService: ActionTrackerService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.renderChartsWhenReady();
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  loadDashboard(): void {
    this.loading = true;
    this.errorMessage = '';
    this.weekFilterError = '';

    this.destroyCharts();

    this.reliabilityKpiService
      .getSummaryByDepartment(this.selectedDepartment)
      .subscribe({
        next: result => {
          this.summary = result;
          this.cdr.detectChanges();
          this.renderChartsWhenReady();
        },
        error: error => {
          console.error(error);
          this.errorMessage = 'Failed to load KPI summary.';
          this.loading = false;
          this.cdr.detectChanges();
        }
      });

    this.reliabilityKpiService
      .getKpisByDepartment(this.selectedDepartment)
      .subscribe({
        next: result => {
          this.kpiTrend = [...result].sort((a, b) =>
            this.compareWeeks(a.week, b.week)
          );

          this.filteredKpiTrend = [...this.kpiTrend];

          this.availableWeeks = Array.from(
            new Set(this.kpiTrend.map(row => row.week))
          ).sort((a, b) => this.compareWeeks(a, b));

          this.fromWeek = '';
          this.toWeek = '';
          this.weekFilterError = '';

          this.loading = false;
          this.cdr.detectChanges();
          this.renderChartsWhenReady();
        },
        error: error => {
          console.error(error);
          this.errorMessage = 'Failed to load KPI trend.';
          this.loading = false;
          this.cdr.detectChanges();
        }
      });

    this.actionTrackerService
      .getActions()
      .subscribe({
        next: result => {
          this.actions = result;
          this.applyActionFilter();
          this.cdr.detectChanges();
          this.renderChartsWhenReady();
        },
        error: error => {
          console.error(error);
          this.errorMessage = 'Failed to load action tracker.';
          this.cdr.detectChanges();
        }
      });
  }

  onDepartmentChange(): void {
    this.activeSection = 'performance';
    this.loadDashboard();
  }

  onActionStatusChange(): void {
    this.applyActionFilter();
    this.cdr.detectChanges();
    this.renderActionStatusChart();
  }

  applyWeekFilter(): void {
    this.weekFilterError = '';

    if (
      this.fromWeek &&
      this.toWeek &&
      this.compareWeeks(this.fromWeek, this.toWeek) > 0
    ) {
      this.weekFilterError = 'From Week cannot be greater than To Week.';
      return;
    }

    this.filteredKpiTrend = this.kpiTrend.filter(row => {
      const isAfterFrom =
        !this.fromWeek || this.compareWeeks(row.week, this.fromWeek) >= 0;

      const isBeforeTo =
        !this.toWeek || this.compareWeeks(row.week, this.toWeek) <= 0;

      return isAfterFrom && isBeforeTo;
    });

    this.cdr.detectChanges();

    this.renderKpiTrendChart();
    this.renderBacklogChart();
    this.renderResourceChart();
  }

  resetWeekFilter(): void {
    this.fromWeek = '';
    this.toWeek = '';
    this.weekFilterError = '';
    this.filteredKpiTrend = [...this.kpiTrend];

    this.cdr.detectChanges();

    this.renderKpiTrendChart();
    this.renderBacklogChart();
    this.renderResourceChart();
  }

  scrollToSection(section: DashboardSection): void {
    this.activeSection = section;

    const element = document.getElementById(section);

    if (!element) {
      return;
    }

    element.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }

  applyActionFilter(): void {
    if (!this.selectedActionStatus) {
      this.filteredActions = [...this.actions];
      return;
    }

    this.filteredActions = this.actions.filter(
      action => action.status === this.selectedActionStatus
    );
  }

  get latestKpiScore(): number {
    if (!this.summary || this.summary.kpis.length === 0) {
      return 0;
    }

    const passed = this.summary.kpis.filter(kpi => kpi.color === 'green').length;

    return Math.round((passed / this.summary.kpis.length) * 100);
  }

  get totalActions(): number {
    return this.actions.length;
  }

  get completedActions(): number {
    return this.actions.filter(x => x.status === 'Complete').length;
  }

  get overdueActions(): number {
    return this.actions.filter(x => x.status === 'Overdue').length;
  }

  get openActions(): number {
    return this.actions.filter(x =>
      x.status === 'Not Started' ||
      x.status === 'In-Progress' ||
      x.status === 'New Action'
    ).length;
  }

  getKpiCardClass(color: string): string {
    switch (color) {
      case 'green':
        return 'kpi-card kpi-success';
      case 'red':
        return 'kpi-card kpi-danger';
      case 'orange':
        return 'kpi-card kpi-warning';
      default:
        return 'kpi-card';
    }
  }

  getStatusClass(status?: string): string {
    switch (status) {
      case 'Complete':
        return 'status-badge status-resolved';
      case 'In-Progress':
        return 'status-badge status-in-progress';
      case 'Not Started':
        return 'status-badge status-open';
      case 'Overdue':
        return 'status-badge status-overdue';
      case 'New Action':
        return 'status-badge status-new';
      default:
        return 'status-badge';
    }
  }

  trackByKpiId(index: number, item: ReliabilityKpi): number {
    return item.id;
  }

  trackByActionId(index: number, item: ActionTracker): number {
    return item.id;
  }

  async exportDashboardToExcel(): Promise<void> {
    this.cdr.detectChanges();
    this.renderChartsWhenReady();

    setTimeout(async () => {
      const workbook = new ExcelJS.Workbook();

      workbook.creator = 'Asset IQ';
      workbook.created = new Date();

      const summarySheet = workbook.addWorksheet('KPI Summary');
      const kpiSheet = workbook.addWorksheet('KPI Records');
      const actionSheet = workbook.addWorksheet('Action Tracker');
      const chartsSheet = workbook.addWorksheet('Dashboard Charts');

      this.buildSummarySheet(summarySheet);
      this.buildKpiRecordsSheet(kpiSheet);
      this.buildActionTrackerSheet(actionSheet);
      this.buildChartsSheet(workbook, chartsSheet);

      const buffer = await workbook.xlsx.writeBuffer();

      const fileName = `Reliability_KPI_Report_${this.selectedDepartment.replace(/\s+/g, '_')}_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`;

      saveAs(
        new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }),
        fileName
      );
    }, 500);
  }

  private buildSummarySheet(sheet: ExcelJS.Worksheet): void {
    sheet.columns = [
      { header: 'Field', key: 'field', width: 35 },
      { header: 'Value', key: 'value', width: 35 }
    ];

    sheet.addRow({ field: 'Department', value: this.selectedDepartment });
    sheet.addRow({ field: 'Latest Week', value: this.summary?.latestWeek || '-' });
    sheet.addRow({ field: 'Week Filter From', value: this.fromWeek || 'All' });
    sheet.addRow({ field: 'Week Filter To', value: this.toWeek || 'All' });
    sheet.addRow({ field: 'KPI Health Score', value: `${this.latestKpiScore}%` });
    sheet.addRow({ field: 'Total Actions', value: this.totalActions });
    sheet.addRow({ field: 'Completed Actions', value: this.completedActions });
    sheet.addRow({ field: 'Open Actions', value: this.openActions });
    sheet.addRow({ field: 'Overdue Actions', value: this.overdueActions });

    sheet.addRow([]);

    const kpiHeaderRow = sheet.addRow([
      'KPI Name',
      'Value',
      'Unit',
      'Target',
      'Status'
    ]);

    kpiHeaderRow.font = { bold: true };

    if (this.summary) {
      this.summary.kpis.forEach(kpi => {
        sheet.addRow([
          kpi.name,
          Number(kpi.value),
          kpi.unit,
          kpi.name === 'Backlog Weeks' ? '2 - 4 weeks' : `${kpi.target}%`,
          kpi.status
        ]);
      });
    }

    this.styleSheetHeader(sheet);
  }

  private buildKpiRecordsSheet(sheet: ExcelJS.Worksheet): void {
    sheet.columns = [
      { header: 'Id', key: 'id', width: 10 },
      { header: 'Department', key: 'department', width: 28 },
      { header: 'Week', key: 'week', width: 16 },
      { header: 'Labour Utilization %', key: 'labourUtilization', width: 24 },
      { header: 'Schedule Compliance %', key: 'scheduleCompliance', width: 26 },
      { header: 'Legal Compliance %', key: 'legalCompliance', width: 24 },
      { header: 'Backlog Weeks', key: 'backlogWeeks', width: 18 },
      { header: 'Resource Compliance %', key: 'resourceCompliance', width: 26 }
    ];

    this.filteredKpiTrend.forEach(row => {
      sheet.addRow({
        id: row.id,
        department: row.department,
        week: row.week,
        labourUtilization: Number(row.labourUtilization),
        scheduleCompliance: Number(row.scheduleCompliance),
        legalCompliance: Number(row.legalCompliance),
        backlogWeeks: Number(row.backlogWeeks),
        resourceCompliance: Number(row.resourceCompliance)
      });
    });

    this.styleSheetHeader(sheet);
  }

  private buildActionTrackerSheet(sheet: ExcelJS.Worksheet): void {
    sheet.columns = [
      { header: 'Id', key: 'id', width: 10 },
      { header: 'Department', key: 'department', width: 28 },
      { header: 'Task', key: 'task', width: 32 },
      { header: 'Notes', key: 'notes', width: 55 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Owner', key: 'owner', width: 28 },
      { header: 'Due Date', key: 'dueDate', width: 18 },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Comments', key: 'comments', width: 55 }
    ];

    this.filteredActions.forEach(action => {
      sheet.addRow({
        id: action.id,
        department: action.department || '-',
        task: action.task || '-',
        notes: action.notes || '-',
        category: action.category || '-',
        owner: action.owner || '-',
        dueDate: action.dueDate ? new Date(action.dueDate) : '-',
        status: action.status || '-',
        comments: action.comments || '-'
      });
    });

    this.styleSheetHeader(sheet);
  }

  private buildChartsSheet(
    workbook: ExcelJS.Workbook,
    sheet: ExcelJS.Worksheet
  ): void {
    sheet.getCell('A1').value = 'Reliability KPI Dashboard Charts';
    sheet.getCell('A1').font = {
      bold: true,
      size: 16,
      color: { argb: 'FFFFFFFF' }
    };
    sheet.getCell('A1').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' }
    };

    sheet.mergeCells('A1:H1');

    let currentRow = 3;

    currentRow = this.addChartImageToSheet(
      workbook,
      sheet,
      this.kpiTrendChart,
      'KPI Weekly Trend',
      currentRow
    );

    currentRow = this.addChartImageToSheet(
      workbook,
      sheet,
      this.kpiStatusChart,
      'Latest KPI Status',
      currentRow
    );

    currentRow = this.addChartImageToSheet(
      workbook,
      sheet,
      this.backlogChart,
      'Backlog Weeks vs Target',
      currentRow
    );

    currentRow = this.addChartImageToSheet(
      workbook,
      sheet,
      this.resourceChart,
      'Resource Compliance',
      currentRow
    );

    this.addChartImageToSheet(
      workbook,
      sheet,
      this.actionStatusChart,
      'Action Status Split',
      currentRow
    );
  }

  private addChartImageToSheet(
    workbook: ExcelJS.Workbook,
    sheet: ExcelJS.Worksheet,
    chart: Chart | undefined,
    title: string,
    startRow: number
  ): number {
    if (!chart) {
      sheet.getCell(`A${startRow}`).value = `${title} chart not available`;
      return startRow + 3;
    }

    sheet.getCell(`A${startRow}`).value = title;
    sheet.getCell(`A${startRow}`).font = {
      bold: true,
      size: 13,
      color: { argb: 'FF0F172A' }
    };

    const base64Image = chart.toBase64Image('image/png', 1);

    const imageId = workbook.addImage({
      base64: base64Image,
      extension: 'png'
    });

    sheet.addImage(imageId, {
      tl: {
        col: 0,
        row: startRow
      },
      ext: {
        width: 850,
        height: 360
      }
    });

    return startRow + 22;
  }

  private styleSheetHeader(sheet: ExcelJS.Worksheet): void {
    const headerRow = sheet.getRow(1);

    headerRow.eachCell(cell => {
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' }
      };

      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F172A' }
      };

      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center'
      };

      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });

    sheet.eachRow((row, rowNumber) => {
      row.eachCell(cell => {
        cell.alignment = {
          vertical: 'top',
          wrapText: true
        };

        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });

      if (rowNumber > 1 && rowNumber % 2 === 0) {
        row.eachCell(cell => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' }
          };
        });
      }
    });

    sheet.views = [
      {
        state: 'frozen',
        ySplit: 1
      }
    ];
  }

  private renderChartsWhenReady(): void {
    if (!this.viewReady) {
      return;
    }

    setTimeout(() => {
      this.renderKpiTrendChart();
      this.renderKpiStatusChart();
      this.renderBacklogChart();
      this.renderResourceChart();
      this.renderActionStatusChart();
    }, 0);
  }

  private renderKpiTrendChart(): void {
    if (!this.kpiTrendChartRef || this.filteredKpiTrend.length === 0) {
      this.kpiTrendChart?.destroy();
      this.kpiTrendChart = undefined;
      return;
    }

    this.kpiTrendChart?.destroy();

    const labels = this.filteredKpiTrend.map(x => x.week);

    const data: ChartData<'line'> = {
      labels,
      datasets: [
        {
          label: 'Labour Utilization %',
          data: this.filteredKpiTrend.map(x => x.labourUtilization),
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.15)',
          tension: 0.35,
          fill: false
        },
        {
          label: 'Schedule Compliance %',
          data: this.filteredKpiTrend.map(x => x.scheduleCompliance),
          borderColor: '#16a34a',
          backgroundColor: 'rgba(22, 163, 74, 0.15)',
          tension: 0.35,
          fill: false
        },
        {
          label: 'Legal Compliance %',
          data: this.filteredKpiTrend.map(x => x.legalCompliance),
          borderColor: '#7c3aed',
          backgroundColor: 'rgba(124, 58, 237, 0.15)',
          tension: 0.35,
          fill: false
        },
        {
          label: 'Resource Compliance %',
          data: this.filteredKpiTrend.map(x => x.resourceCompliance),
          borderColor: '#ea580c',
          backgroundColor: 'rgba(234, 88, 12, 0.15)',
          tension: 0.35,
          fill: false
        }
      ]
    };

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'bottom'
          },
          tooltip: {
            callbacks: {
              label: context => `${context.dataset.label}: ${context.parsed.y}%`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            suggestedMax: 120,
            ticks: {
              callback: value => `${value}%`
            }
          }
        }
      }
    };

    this.kpiTrendChart = new Chart(
      this.kpiTrendChartRef.nativeElement,
      config
    );
  }

  private renderKpiStatusChart(): void {
    if (!this.kpiStatusChartRef || !this.summary) {
      return;
    }

    this.kpiStatusChart?.destroy();

    const labels = this.summary.kpis.map(kpi => kpi.name);
    const values = this.summary.kpis.map(kpi => kpi.value);

    const data: ChartData<'bar'> = {
      labels,
      datasets: [
        {
          label: 'Latest KPI Value',
          data: values,
          backgroundColor: this.summary.kpis.map(kpi =>
            this.getChartColor(kpi.color)
          ),
          borderRadius: 10
        }
      ]
    };

    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    };

    this.kpiStatusChart = new Chart(
      this.kpiStatusChartRef.nativeElement,
      config
    );
  }

  private renderBacklogChart(): void {
    if (!this.backlogChartRef || this.filteredKpiTrend.length === 0) {
      this.backlogChart?.destroy();
      this.backlogChart = undefined;
      return;
    }

    this.backlogChart?.destroy();

    const labels = this.filteredKpiTrend.map(x => x.week);

    const data: ChartData = {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Backlog Weeks',
          data: this.filteredKpiTrend.map(x => x.backlogWeeks),
          backgroundColor: '#f59e0b',
          borderRadius: 10
        },
        {
          type: 'line',
          label: 'Minimum Target',
          data: this.filteredKpiTrend.map(() => 2),
          borderColor: '#16a34a',
          backgroundColor: '#16a34a',
          pointRadius: 3,
          tension: 0.3
        },
        {
          type: 'line',
          label: 'Maximum Target',
          data: this.filteredKpiTrend.map(() => 4),
          borderColor: '#dc2626',
          backgroundColor: '#dc2626',
          pointRadius: 3,
          tension: 0.3
        }
      ]
    };

    const config: ChartConfiguration = {
      type: 'bar',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            position: 'bottom'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Weeks'
            }
          }
        }
      }
    };

    this.backlogChart = new Chart(
      this.backlogChartRef.nativeElement,
      config
    );
  }

  private renderResourceChart(): void {
    if (!this.resourceChartRef || this.filteredKpiTrend.length === 0) {
      this.resourceChart?.destroy();
      this.resourceChart = undefined;
      return;
    }

    this.resourceChart?.destroy();

    const labels = this.filteredKpiTrend.map(x => x.week);

    const data: ChartData = {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Resource Compliance %',
          data: this.filteredKpiTrend.map(x => x.resourceCompliance),
          backgroundColor: '#2563eb',
          borderRadius: 10
        },
        {
          type: 'line',
          label: 'Target 100%',
          data: this.filteredKpiTrend.map(() => 100),
          borderColor: '#dc2626',
          backgroundColor: '#dc2626',
          pointRadius: 3,
          tension: 0.3
        }
      ]
    };

    const config: ChartConfiguration = {
      type: 'bar',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            position: 'bottom'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            suggestedMax: 120,
            ticks: {
              callback: value => `${value}%`
            }
          }
        }
      }
    };

    this.resourceChart = new Chart(
      this.resourceChartRef.nativeElement,
      config
    );
  }

  private renderActionStatusChart(): void {
    if (!this.actionStatusChartRef || this.actions.length === 0) {
      return;
    }

    this.actionStatusChart?.destroy();

    const grouped = this.actions.reduce((acc, action) => {
      const key = action.status || 'Unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const labels = Object.keys(grouped);
    const values = Object.values(grouped);

    const data: ChartData<'doughnut'> = {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: labels.map(label =>
            this.getStatusChartColor(label)
          ),
          borderWidth: 2
        }
      ]
    };

    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    };

    this.actionStatusChart = new Chart(
      this.actionStatusChartRef.nativeElement,
      config
    );
  }

  private compareWeeks(a: string, b: string): number {
    const weekA = Number(a);
    const weekB = Number(b);

    if (!Number.isNaN(weekA) && !Number.isNaN(weekB)) {
      return weekA - weekB;
    }

    return a.localeCompare(b);
  }

  private getChartColor(color: string): string {
    switch (color) {
      case 'green':
        return '#16a34a';
      case 'red':
        return '#dc2626';
      case 'orange':
        return '#f59e0b';
      default:
        return '#64748b';
    }
  }

  private getStatusChartColor(status: string): string {
    switch (status) {
      case 'Complete':
        return '#16a34a';
      case 'In-Progress':
        return '#f59e0b';
      case 'Not Started':
        return '#2563eb';
      case 'Overdue':
        return '#dc2626';
      case 'New Action':
        return '#7c3aed';
      default:
        return '#64748b';
    }
  }

  private destroyCharts(): void {
    this.kpiTrendChart?.destroy();
    this.kpiStatusChart?.destroy();
    this.backlogChart?.destroy();
    this.resourceChart?.destroy();
    this.actionStatusChart?.destroy();

    this.kpiTrendChart = undefined;
    this.kpiStatusChart = undefined;
    this.backlogChart = undefined;
    this.resourceChart = undefined;
    this.actionStatusChart = undefined;
  }
}