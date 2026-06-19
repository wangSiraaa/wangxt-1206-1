export type Role = 'station' | 'delivery' | 'supervisor';

export type FillingStatus = 'normal' | 'recheck' | 'blocked_overdue';

export type InspectionResult = 'pass' | 'abnormal' | 'seized';

export type BlockCode =
  | 'CYLINDER_OVERDUE'
  | 'WEIGHT_OUT_OF_TOLERANCE'
  | 'RECORD_LOCKED_DELIVERED';

export interface Cylinder {
  id: number;
  cylinder_code: string;
  spec: string;
  target_weight: number;
  tolerance: number;
  inspection_date: string | null;
  inspection_expiry: string | null;
  created_at: string;
}

export interface FillingRecord {
  id: number;
  cylinder_code: string;
  station: string;
  operator: string;
  target_weight: number;
  filling_weight: number | null;
  weight_diff: number | null;
  status: FillingStatus;
  delivered: number;
  created_at: string;
  updated_at: string;
}

export interface DeliveryRecord {
  id: number;
  cylinder_code: string;
  filling_id: number;
  delivery_person: string;
  destination: string;
  recipient: string | null;
  delivered_at: string;
}

export interface Inspection {
  id: number;
  cylinder_code: string;
  inspector: string;
  result: InspectionResult;
  remark: string | null;
  inspected_at: string;
}

export interface AnomalyLog {
  id: number;
  block_code: BlockCode;
  cylinder_code: string | null;
  detail: string;
  operator: string | null;
  created_at: string;
}

export interface TraceRecord {
  cylinder: Cylinder;
  fillings: FillingRecord[];
  deliveries: DeliveryRecord[];
  inspections: Inspection[];
}

export interface Stats {
  cylinders: number;
  fillings_today: number;
  in_delivery: number;
  blocked_count: number;
  inspection_abnormal_rate: number;
}

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export interface BlockResult {
  blocked: boolean;
  code: BlockCode | null;
  message: string;
  detail?: unknown;
}
