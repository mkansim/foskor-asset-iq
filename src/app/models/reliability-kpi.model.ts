export interface ReliabilityKpi {
  id: number;
  department: string;
  week: string;
  labourUtilization: number;
  scheduleCompliance: number;
  legalCompliance: number;
  backlogWeeks: number;
  resourceCompliance: number;
}

export interface KpiStatus {
  name: string;
  value: number;
  unit: string;
  target: number;
  status: string;
  color: string;
}

export interface KpiSummary {
  department: string;
  latestWeek: string;
  kpis: KpiStatus[];
}