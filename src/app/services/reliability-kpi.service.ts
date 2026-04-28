import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { KpiSummary, ReliabilityKpi } from '../models/reliability-kpi.model';

@Injectable({
  providedIn: 'root'
})
export class ReliabilityKpiService {
  private apiUrl = 'https://localhost:7114/api/reliability-kpis';

  constructor(private http: HttpClient) {}

  getKpis(): Observable<ReliabilityKpi[]> {
    return this.http.get<ReliabilityKpi[]>(this.apiUrl);
  }

  getKpisByDepartment(department: string): Observable<ReliabilityKpi[]> {
    const encodedDepartment = encodeURIComponent(department);

    return this.http.get<ReliabilityKpi[]>(
      `${this.apiUrl}/department/${encodedDepartment}`
    );
  }

  getSummaryByDepartment(department: string): Observable<KpiSummary> {
    const encodedDepartment = encodeURIComponent(department);

    return this.http.get<KpiSummary>(
      `${this.apiUrl}/department/${encodedDepartment}/summary`
    );
  }
}