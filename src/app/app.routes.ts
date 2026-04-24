import { Routes } from '@angular/router';
import { IssuesComponent } from './reports/issues/issues.component';
import { RaiseIssueComponent } from './reports/raise-issue/raise-issue.component';
import { IssueListComponent } from './reports/issue-list/issue-list.component';
import { ViewIssueComponent } from './reports/view-issue/view-issue.component';
import { LoginComponent } from './auth/login.component';
import { AuthGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/reports', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'reports', component: IssuesComponent, canActivate: [AuthGuard] },
  { path: 'issues', component: IssueListComponent, canActivate: [AuthGuard] },
  { path: 'overview', component: IssuesComponent, canActivate: [AuthGuard] },
  { path: 'raise-issue', component: RaiseIssueComponent, canActivate: [AuthGuard] },
  { path: 'view-issue', component: ViewIssueComponent, canActivate: [AuthGuard] },
  { path: '**', redirectTo: '/reports' }
];
