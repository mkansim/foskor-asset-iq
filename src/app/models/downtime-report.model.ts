export interface DowntimeReport {
  id?: number;
  section: string;
  department: string;
  equipment: string;
  cause: string;
  reason: string;
  stopDate: Date;
  startDate: Date;
  downtimeHours: number;
}