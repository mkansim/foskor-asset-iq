import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MaintenanceIssue } from '../../models/maintenanceI-issue.model';

@Component({
  selector: 'app-view-issue',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './view-issue.component.html',
  styleUrls: ['./view-issue.component.scss']
})
export class ViewIssueComponent implements OnInit {
  issue: MaintenanceIssue | null = null;

  constructor(private router: Router) {}

  ngOnInit(): void {
    const state = window.history.state as { issue?: MaintenanceIssue };

    if (!state?.issue) {
      this.router.navigate(['/issues']);
      return;
    }

    this.issue = {
      ...state.issue,
      dueDate: state.issue.dueDate ? new Date(state.issue.dueDate) : new Date()
    };
  }

  goBack(): void {
    this.router.navigate(['/issues']);
  }
}
