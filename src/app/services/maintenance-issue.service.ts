import { Injectable } from '@angular/core';
import { MaintenanceIssue } from '../models/maintenanceI-issue.model';

@Injectable({
  providedIn: 'root'
})
export class MaintenanceIssueService {
  private issues: MaintenanceIssue[] = [
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

  getIssues(): MaintenanceIssue[] {
    return this.issues;
  }

  getIssue(index: number): MaintenanceIssue | undefined {
    return this.issues[index];
  }

  addIssue(issue: MaintenanceIssue): void {
    this.issues.unshift(issue);
  }

  updateIssue(index: number, issue: MaintenanceIssue): void {
    if (index < 0 || index >= this.issues.length) {
      return;
    }
    this.issues[index] = issue;
  }

  deleteIssue(index: number): void {
    if (index < 0 || index >= this.issues.length) {
      return;
    }
    this.issues.splice(index, 1);
  }
}
