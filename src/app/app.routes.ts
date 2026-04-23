import { Routes } from '@angular/router';
import { IssuesComponent } from './reports/issues/issues.component';
import { RaiseIssueComponent } from './reports/raise-issue/raise-issue.component';
import { IssueListComponent } from './reports/issue-list/issue-list.component';

export const routes: Routes = [
  { path: '', redirectTo: '/reports', pathMatch: 'full' },
  { path: 'reports', component: IssuesComponent },
  { path: 'issues', component: IssueListComponent },
  { path: 'overview', component: IssuesComponent },
  { path: 'raise-issue', component: RaiseIssueComponent },
  { path: '**', redirectTo: '/reports' }
];
