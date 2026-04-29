import { CommonModule, DecimalPipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ReliabilityKpi } from '../../models/reliability-kpi.model';
import { ReliabilityKpiService } from '../../services/reliability-kpi.service';

@Component({
  selector: 'app-manage-compliance',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DecimalPipe
  ],
  templateUrl: './manage-compliance.component.html',
  styleUrl: './manage-compliance.component.scss'
})
export class ManageComplianceComponent implements OnInit {
  isEditMode = false;
  loading = false;
  saving = false;
  errorMessage = '';
  successMessage = '';

  kpis: ReliabilityKpi[] = [];

  departments: string[] = [
    'Mechanical Workshop',
    'Electrical Workshop'
  ];

  kpi: ReliabilityKpi = this.createEmptyKpi();

  constructor(private reliabilityKpiService: ReliabilityKpiService) {}

  ngOnInit(): void {
    this.loadKpis();
  }

  loadKpis(): void {
    this.loading = true;
    this.errorMessage = '';

    this.reliabilityKpiService.getKpis().subscribe({
      next: result => {
        this.kpis = [...result].sort((a, b) => {
          const departmentCompare = a.department.localeCompare(b.department);

          if (departmentCompare !== 0) {
            return departmentCompare;
          }

          return this.compareWeeks(a.week, b.week);
        });

        this.loading = false;
      },
      error: error => {
        console.error(error);
        this.errorMessage = 'Failed to load KPI records.';
        this.loading = false;
      }
    });
  }

  onSubmit(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.validateForm()) {
      return;
    }

    this.saving = true;

    if (this.isEditMode) {
      this.reliabilityKpiService.updateKpi(this.kpi.id, this.kpi).subscribe({
        next: () => {
          this.successMessage = 'Compliance KPI updated successfully.';
          this.saving = false;
          this.cancelEdit();
          this.loadKpis();
        },
        error: error => {
          console.error(error);
          this.errorMessage = 'Failed to update compliance KPI.';
          this.saving = false;
        }
      });

      return;
    }

    const payload: ReliabilityKpi = {
      ...this.kpi,
      id: 0
    };

    this.reliabilityKpiService.createKpi(payload).subscribe({
      next: () => {
        this.successMessage = 'Compliance KPI created successfully.';
        this.saving = false;
        this.kpi = this.createEmptyKpi();
        this.loadKpis();
      },
      error: error => {
        console.error(error);
        this.errorMessage = 'Failed to create compliance KPI.';
        this.saving = false;
      }
    });
  }

  editKpi(row: ReliabilityKpi): void {
    this.isEditMode = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.kpi = {
      id: row.id,
      department: row.department,
      week: row.week,
      labourUtilization: row.labourUtilization,
      scheduleCompliance: row.scheduleCompliance,
      legalCompliance: row.legalCompliance,
      backlogWeeks: row.backlogWeeks,
      resourceCompliance: row.resourceCompliance
    };

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  deleteKpi(row: ReliabilityKpi): void {
    const confirmed = confirm(
      `Delete KPI record for ${row.department}, week ${row.week}?`
    );

    if (!confirmed) {
      return;
    }

    this.reliabilityKpiService.deleteKpi(row.id).subscribe({
      next: () => {
        this.successMessage = 'Compliance KPI deleted successfully.';
        this.loadKpis();
      },
      error: error => {
        console.error(error);
        this.errorMessage = 'Failed to delete compliance KPI.';
      }
    });
  }

  cancelEdit(): void {
    this.isEditMode = false;
    this.kpi = this.createEmptyKpi();
  }

  private validateForm(): boolean {
    if (!this.kpi.department?.trim()) {
      this.errorMessage = 'Department is required.';
      return false;
    }

    if (!this.kpi.week?.trim()) {
      this.errorMessage = 'Week is required.';
      return false;
    }

    if (this.kpi.labourUtilization < 0) {
      this.errorMessage = 'Labour Utilization cannot be negative.';
      return false;
    }

    if (this.kpi.scheduleCompliance < 0) {
      this.errorMessage = 'Schedule Compliance cannot be negative.';
      return false;
    }

    if (this.kpi.legalCompliance < 0) {
      this.errorMessage = 'Legal Compliance cannot be negative.';
      return false;
    }

    if (this.kpi.backlogWeeks < 0) {
      this.errorMessage = 'Backlog Weeks cannot be negative.';
      return false;
    }

    if (this.kpi.resourceCompliance < 0) {
      this.errorMessage = 'Resource Compliance cannot be negative.';
      return false;
    }

    return true;
  }

  private createEmptyKpi(): ReliabilityKpi {
    return {
      id: 0,
      department: 'Mechanical Workshop',
      week: '',
      labourUtilization: 0,
      scheduleCompliance: 0,
      legalCompliance: 100,
      backlogWeeks: 0,
      resourceCompliance: 0
    };
  }

  private compareWeeks(a: string, b: string): number {
    const weekA = Number(a);
    const weekB = Number(b);

    if (!Number.isNaN(weekA) && !Number.isNaN(weekB)) {
      return weekA - weekB;
    }

    return a.localeCompare(b);
  }
}