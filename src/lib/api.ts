import type {
  ApiResult,
  Cylinder,
  FillingRecord,
  DeliveryRecord,
  Inspection,
  AnomalyLog,
  TraceRecord,
  Stats,
  BlockCode,
  SpotCheck,
  CylinderLock,
  InspectionResult,
} from '@shared/types';

export class ApiError extends Error {
  code?: string;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  let json: ApiResult<T>;
  try {
    json = (await res.json()) as ApiResult<T>;
  } catch {
    throw new ApiError(`请求失败 (${res.status})`, res.status);
  }
  if (!json.ok) {
    throw new ApiError(json.error.message, res.status, json.error.code);
  }
  return json.data;
}

function qs(params: Record<string, string | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') usp.set(k, v);
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

export const api = {
  listCylinders: () => request<Cylinder[]>('/cylinders'),
  listLockedCylinders: () => request<Cylinder[]>('/cylinders/locked'),
  getCylinder: (code: string) => request<Cylinder>(`/cylinders/${encodeURIComponent(code)}`),
  createCylinder: (body: Partial<Cylinder>) =>
    request<Cylinder>('/cylinders', { method: 'POST', body: JSON.stringify(body) }),
  updateInspection: (code: string, body: { inspection_date: string; inspection_expiry: string }) =>
    request<Cylinder>(`/cylinders/${encodeURIComponent(code)}/inspection`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  unlockCylinder: (code: string) =>
    request<Cylinder>(`/cylinders/${encodeURIComponent(code)}/unlock`, { method: 'POST' }),
  listCylinderLocks: (code: string) =>
    request<CylinderLock[]>(`/cylinders/${encodeURIComponent(code)}/locks`),

  listFillings: (filter: { status?: string; code?: string } = {}) =>
    request<FillingRecord[]>(`/filling${qs(filter)}`),
  createFilling: (body: { cylinder_code: string; filling_weight: number; operator: string; station: string }) =>
    request<FillingRecord>('/filling', { method: 'POST', body: JSON.stringify(body) }),
  recheck: (id: number, weight: number) =>
    request<FillingRecord>(`/filling/${id}/recheck`, { method: 'POST', body: JSON.stringify({ weight }) }),
  modifyFilling: (id: number, weight: number) =>
    request<FillingRecord>(`/filling/${id}`, { method: 'PUT', body: JSON.stringify({ filling_weight: weight }) }),

  listDeliveries: () => request<DeliveryRecord[]>('/delivery'),
  createDelivery: (body: { cylinder_code: string; delivery_person: string; destination: string; recipient?: string }) =>
    request<DeliveryRecord>('/delivery', { method: 'POST', body: JSON.stringify(body) }),

  listInspections: () => request<Inspection[]>('/inspect'),
  createInspection: (body: {
    cylinder_code: string;
    inspector: string;
    result: 'pass' | 'abnormal' | 'seized';
    remark?: string;
  }) => request<Inspection>('/inspect', { method: 'POST', body: JSON.stringify(body) }),

  listSpotChecks: (code?: string) =>
    request<SpotCheck[]>(`/spot-checks${qs({ code })}`),
  listSpotChecksForFilling: (fillingId: number) =>
    request<SpotCheck[]>(`/spot-checks/filling/${fillingId}`),
  createSpotCheck: (body: {
    cylinder_code: string;
    filling_id: number;
    inspector: string;
    result: InspectionResult;
    remark?: string;
  }) => request<SpotCheck>('/spot-checks', { method: 'POST', body: JSON.stringify(body) }),

  getTrace: (code: string) => request<TraceRecord>(`/trace/${encodeURIComponent(code)}`),
  listAnomalies: (limit = 100) => request<AnomalyLog[]>(`/anomalies${qs({ limit: String(limit) })}`),
  getStats: () => request<Stats>('/stats'),
  demoReset: () => request<{ reset: true }>('/demo/reset', { method: 'POST' }),
};

export function isBlockCode(code: unknown): code is BlockCode {
  return (
    code === 'CYLINDER_OVERDUE' ||
    code === 'WEIGHT_OUT_OF_TOLERANCE' ||
    code === 'RECORD_LOCKED_DELIVERED' ||
    code === 'CYLINDER_LOCKED' ||
    code === 'RECHECK_EXCEEDED'
  );
}
