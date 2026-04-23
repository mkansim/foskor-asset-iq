import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaintenanceIssue } from '../../models/maintenanceI-issue.model';

@Component({
  selector: 'app-raise-issue',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './raise-issue.component.html',
  styleUrls: ['./raise-issue.component.scss']
})
export class RaiseIssueComponent {
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

  onSubmit(): void {
    this.issue.createdAt = new Date();
    console.log('Raised issue:', this.issue);
    alert('Maintenance issue form submitted. Check console for payload.');
  }

  onDueDateChange(value: string): void {
    this.issue.dueDate = value ? new Date(value) : new Date();
  }
}
