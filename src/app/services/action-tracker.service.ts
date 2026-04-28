import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ActionTracker } from '../models/action-tracker.model';

@Injectable({
  providedIn: 'root'
})
export class ActionTrackerService {
  private apiUrl = 'https://localhost:7114/api/action-tracker';

  constructor(private http: HttpClient) {}

  getActions(): Observable<ActionTracker[]> {
    return this.http.get<ActionTracker[]>(this.apiUrl);
  }

  getActionsByStatus(status: string): Observable<ActionTracker[]> {
    const encodedStatus = encodeURIComponent(status);

    return this.http.get<ActionTracker[]>(
      `${this.apiUrl}/status/${encodedStatus}`
    );
  }
}