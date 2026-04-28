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

import { ReliabilityKpiService } from '../../services/reliability-kpi.service';
import { ActionTrackerService } from '../../services/action-tracker.service';

import { ReliabilityKpi, KpiSummary } from '../../models/reliability-kpi.model';
import { ActionTracker } from '../../models/action-tracker.model';

Chart.register(...registerables);

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
  actions: ActionTracker[] = [];
  filteredActions: ActionTracker[] = [];

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

    this.reliabilityKpiService
      .getSummaryByDepartment(this.selectedDepartment)
      .subscribe({
        next: result => {
          this.summary = result;
          this.renderChartsWhenReady();
        },
        error: error => {
          console.error(error);
          this.errorMessage = 'Failed to load KPI summary.';
          this.loading = false;
        }
        
      });

    this.reliabilityKpiService
      .getKpisByDepartment(this.selectedDepartment)
      .subscribe({
        next: result => {
          this.kpiTrend = result;
          this.loading = false;
          this.renderChartsWhenReady();
        },
        error: error => {
          console.error(error);
          this.errorMessage = 'Failed to load KPI trend.';
          this.loading = false;
        }
      });

    this.actionTrackerService
      .getActions()
      .subscribe({
        next: result => {
          this.actions = result;
          this.applyActionFilter();
          this.renderChartsWhenReady();
        },
        error: error => {
          console.error(error);
          this.errorMessage = 'Failed to load action tracker.';
        }
      });
      this.cdr.detectChanges();

  }

  onDepartmentChange(): void {
    this.loadDashboard();
  }

  onActionStatusChange(): void {
    this.applyActionFilter();
    this.renderActionStatusChart();
  }

  applyActionFilter(): void {
    if (!this.selectedActionStatus) {
      this.filteredActions = this.actions;
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
    if (!this.kpiTrendChartRef || this.kpiTrend.length === 0) {
      return;
    }

    this.kpiTrendChart?.destroy();

    const labels = this.kpiTrend.map(x => x.week);

    const data: ChartData<'line'> = {
      labels,
      datasets: [
        {
          label: 'Labour Utilization %',
          data: this.kpiTrend.map(x => x.labourUtilization),
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.15)',
          tension: 0.35,
          fill: false
        },
        {
          label: 'Schedule Compliance %',
          data: this.kpiTrend.map(x => x.scheduleCompliance),
          borderColor: '#16a34a',
          backgroundColor: 'rgba(22, 163, 74, 0.15)',
          tension: 0.35,
          fill: false
        },
        {
          label: 'Legal Compliance %',
          data: this.kpiTrend.map(x => x.legalCompliance),
          borderColor: '#7c3aed',
          backgroundColor: 'rgba(124, 58, 237, 0.15)',
          tension: 0.35,
          fill: false
        },
        {
          label: 'Resource Compliance %',
          data: this.kpiTrend.map(x => x.resourceCompliance),
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
    if (!this.backlogChartRef || this.kpiTrend.length === 0) {
      return;
    }

    this.backlogChart?.destroy();

    const labels = this.kpiTrend.map(x => x.week);

    const data: ChartData = {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Backlog Weeks',
          data: this.kpiTrend.map(x => x.backlogWeeks),
          backgroundColor: '#f59e0b',
          borderRadius: 10
        },
        {
          type: 'line',
          label: 'Minimum Target',
          data: this.kpiTrend.map(() => 2),
          borderColor: '#16a34a',
          backgroundColor: '#16a34a',
          pointRadius: 3,
          tension: 0.3
        },
        {
          type: 'line',
          label: 'Maximum Target',
          data: this.kpiTrend.map(() => 4),
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
    if (!this.resourceChartRef || this.kpiTrend.length === 0) {
      return;
    }

    this.resourceChart?.destroy();

    const labels = this.kpiTrend.map(x => x.week);

    const data: ChartData = {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Resource Compliance %',
          data: this.kpiTrend.map(x => x.resourceCompliance),
          backgroundColor: '#2563eb',
          borderRadius: 10
        },
        {
          type: 'line',
          label: 'Target 100%',
          data: this.kpiTrend.map(() => 100),
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
  }
}