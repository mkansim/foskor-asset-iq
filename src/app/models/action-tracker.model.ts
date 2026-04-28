export interface ActionTracker {
  id: number;
  department?: string;
  task?: string;
  notes: string;
  category?: string;
  owner?: string;
  dueDate?: string;
  status?: string;
  comments?: string;
}