import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaintenanceIssue } from '../../models/maintenanceI-issue.model';

@Component({
  selector: 'app-issue-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './issue-list.component.html',
  styleUrls: ['./issue-list.component.scss']
})
export class IssueListComponent implements OnInit {
  issues: MaintenanceIssue[] = [];
  filteredIssues: MaintenanceIssue[] = [];
  searchText: string = '';
  statusFilter: string = '';
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  currentPage: number = 1;
  pageSize: number = 10;
  totalItems: number = 0;
  totalPages: number = 0;

  statusOptions: string[] = ['Open', 'In Progress', 'Resolved', 'Closed'];

  ngOnInit(): void {
    this.loadMockData();
    this.applyFiltersAndSort();
  }

  loadMockData(): void {
    this.issues = [
      {
        section: 'Production Line A',
        equipment: 'Compressor Unit 1',
        problemIssue: 'High temperature readings',
        source: 'Thermal sensor',
        cause: 'Reduced cooling capacity',
        action: 'Replace cooling fins',
        criticality: 'High',
        responsiblePerson: 'John Doe',
        dueDate: new Date(2026, 4, 1),
        totalPlantStoppageRequired: true,
        timeRequiredHours: 4.5,
        status: 'Open',
        comments: 'Urgent attention needed',
        createdAt: new Date(2026, 3, 20)
      },
      {
        section: 'Production Line B',
        equipment: 'Pump Motor 2',
        problemIssue: 'Abnormal vibration',
        source: 'Vibration monitor',
        cause: 'Bearing wear',
        action: 'Replace bearing assembly',
        criticality: 'Medium',
        responsiblePerson: 'Jane Smith',
        dueDate: new Date(2026, 4, 5),
        totalPlantStoppageRequired: false,
        timeRequiredHours: 2.0,
        status: 'In Progress',
        comments: 'Spare parts ordered',
        createdAt: new Date(2026, 3, 18)
      },
      {
        section: 'Quality Control',
        equipment: 'Measurement Device 3',
        problemIssue: 'Calibration drift',
        source: 'Quality audit',
        cause: 'Thermal variation',
        action: 'Recalibrate device',
        criticality: 'Low',
        responsiblePerson: 'Mike Johnson',
        dueDate: new Date(2026, 4, 10),
        totalPlantStoppageRequired: false,
        timeRequiredHours: 1.0,
        status: 'Resolved',
        comments: 'Completed successfully',
        createdAt: new Date(2026, 3, 15)
      },
      {
        section: 'Production Line A',
        equipment: 'Conveyor Belt 1',
        problemIssue: 'Belt slipping',
        source: 'Operator observation',
        cause: 'Loose tension',
        action: 'Adjust belt tension',
        criticality: 'Medium',
        responsiblePerson: 'Sarah Lee',
        dueDate: new Date(2026, 4, 3),
        totalPlantStoppageRequired: false,
        timeRequiredHours: 0.5,
        status: 'Closed',
        comments: 'Work completed',
        createdAt: new Date(2026, 3, 19)
      },
      {
        section: 'Maintenance',
        equipment: 'Hydraulic Press',
        problemIssue: 'Pressure leak',
        source: 'Routine inspection',
        cause: 'Seal degradation',
        action: 'Replace seals',
        criticality: 'High',
        responsiblePerson: 'Tom Wilson',
        dueDate: new Date(2026, 3, 28),
        totalPlantStoppageRequired: true,
        timeRequiredHours: 3.5,
        status: 'Open',
        comments: 'Critical priority',
        createdAt: new Date(2026, 3, 21)
      }
    ];
    this.totalItems = this.issues.length;
  }

  applyFiltersAndSort(): void {
    let result = [...this.issues];

    if (this.searchText) {
      const text = this.searchText.toLowerCase();
      result = result.filter(
        issue =>
          issue.section.toLowerCase().includes(text) ||
          issue.equipment.toLowerCase().includes(text) ||
          issue.problemIssue.toLowerCase().includes(text) ||
          issue.responsiblePerson.toLowerCase().includes(text)
      );
    }

    if (this.statusFilter) {
      result = result.filter(issue => issue.status === this.statusFilter);
    }

    if (this.sortColumn) {
      result.sort((a, b) => {
        let aVal: any = (a as any)[this.sortColumn];
        let bVal: any = (b as any)[this.sortColumn];

        if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = (bVal as string).toLowerCase();
        }

        if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    this.totalItems = result.length;
    this.totalPages = Math.ceil(this.totalItems / this.pageSize);
    this.currentPage = 1;

    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.filteredIssues = result.slice(startIndex, endIndex);
  }

  onSearch(): void {
    this.applyFiltersAndSort();
  }

  onStatusFilterChange(): void {
    this.applyFiltersAndSort();
  }

  onSort(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.applyFiltersAndSort();
  }

  getSortIcon(column: string): string {
    if (this.sortColumn !== column) return '⇅';
    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      const startIndex = (this.currentPage - 1) * this.pageSize;
      const endIndex = startIndex + this.pageSize;
      let result = [...this.issues];

      if (this.searchText) {
        const text = this.searchText.toLowerCase();
        result = result.filter(
          issue =>
            issue.section.toLowerCase().includes(text) ||
            issue.equipment.toLowerCase().includes(text) ||
            issue.problemIssue.toLowerCase().includes(text) ||
            issue.responsiblePerson.toLowerCase().includes(text)
        );
      }

      if (this.statusFilter) {
        result = result.filter(issue => issue.status === this.statusFilter);
      }

      if (this.sortColumn) {
        result.sort((a, b) => {
          let aVal: any = (a as any)[this.sortColumn];
          let bVal: any = (b as any)[this.sortColumn];

          if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = (bVal as string).toLowerCase();
          }

          if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
          if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
          return 0;
        });
      }

      this.filteredIssues = result.slice(startIndex, endIndex);
    }
  }
}
