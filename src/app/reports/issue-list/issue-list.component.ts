import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MaintenanceIssue } from '../../models/maintenanceI-issue.model';
import { MaintenanceIssueService } from '../../services/maintenance-issue.service';

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

  constructor(private issueService: MaintenanceIssueService, private router: Router) {}

  ngOnInit(): void {
    this.loadIssues();
  }

  loadIssues(): void {
      this.issueService.getIssues().subscribe(issues => {
      this.issues = issues;
      this.applyFiltersAndSort();
    });
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

  viewIssue(issue: MaintenanceIssue): void {
    this.router.navigate(['/view-issue'], {
      state: {
        issue,
        id: issue.id
      }
    });
  }

  updateIssue(issue: MaintenanceIssue): void {
    this.router.navigate(['/raise-issue'], {
      state: {
        issue,
        id: issue.id,
        mode: 'edit'
      }
    });
  }

  deleteIssue(issue: MaintenanceIssue): void {
    const confirmed = window.confirm(`Delete issue for ${issue.equipment}?`);
    if (!confirmed) {
      return;
    }

    this.issueService.deleteIssue(issue.id!).subscribe(() => {
      this.loadIssues();
    });
  }
}
