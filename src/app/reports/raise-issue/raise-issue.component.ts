import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MaintenanceIssue } from '../../models/maintenanceI-issue.model';
import { MaintenanceIssueService } from '../../services/maintenance-issue.service';

@Component({
  selector: 'app-raise-issue',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './raise-issue.component.html',
  styleUrls: ['./raise-issue.component.scss']
})
export class RaiseIssueComponent implements OnInit {
  issue: MaintenanceIssue = {
    section: '',
    equipment: '',
    problemIssue: '',
    source: '',
    cause: '',
    action: '',
    criticality: '',
    responsiblePerson: '',
    dueDate: new Date(),
    totalPlantStoppageRequired: false,
    timeRequiredHours: 0,
    status: 'Open',
    comments: '',
    createdAt: new Date()
  };

  isEditMode = false;
  editIndex: number | null = null;

  constructor(private router: Router, private issueService: MaintenanceIssueService) {}

  ngOnInit(): void {
    const state = window.history.state as {
      issue?: MaintenanceIssue;
      index?: number;
      mode?: string;
    };

    if (state?.mode === 'edit' && state.issue !== undefined && state.index !== undefined) {
      this.isEditMode = true;
      this.editIndex = state.index;
      this.issue = {
        ...state.issue,
        dueDate: state.issue.dueDate ? new Date(state.issue.dueDate) : new Date()
      };
    }
  }

  onSubmit(): void {
    if (this.isEditMode && this.editIndex !== null) {
      this.issueService.updateIssue(this.editIndex, this.issue);
      alert('Maintenance issue updated successfully.');
    } else {
      this.issue.createdAt = new Date();
      this.issueService.addIssue(this.issue);
      alert('Maintenance issue submitted successfully.');
    }

    this.router.navigate(['/issues']);
  }

  onDueDateChange(value: string): void {
    this.issue.dueDate = value ? new Date(value) : new Date();
  }
}
