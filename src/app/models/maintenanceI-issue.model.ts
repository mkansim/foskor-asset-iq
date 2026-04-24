export interface MaintenanceIssue {
  id?: number;
  section: string;
  equipment: string;
  problemIssue: string;
  source: string;
  cause: string;
  action: string;
  criticality: string;
  responsiblePerson: string;
  dueDate: Date;
  totalPlantStoppageRequired: boolean;
  timeRequiredHours: number;
  status: string;
  comments: string;
  createdAt: Date;
}
