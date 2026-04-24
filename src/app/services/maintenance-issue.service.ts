import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MaintenanceIssue } from '../models/maintenanceI-issue.model';

@Injectable({
  providedIn: 'root'
})
export class MaintenanceIssueService {
  private apiUrl = '/api/MaintenanceIssues';

  constructor(private http: HttpClient) {}

  getIssues(): Observable<MaintenanceIssue[]> {
    return this.http.get<MaintenanceIssue[]>(this.apiUrl);
  }

  getIssue(id: number): Observable<MaintenanceIssue> {
    return this.http.get<MaintenanceIssue>(`${this.apiUrl}/${id}`);
  }

  updateIssue(id: number, issue: MaintenanceIssue): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, issue);
  }

  createIssue(issue: MaintenanceIssue): Observable<MaintenanceIssue> {
    return this.http.post<MaintenanceIssue>(this.apiUrl, issue);
  }

  deleteIssue(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
