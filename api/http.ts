import type { Response } from 'express';
import type { ApiResult } from '../shared/types.js';

export function ok<T>(res: Response, data: T): void {
  const body: ApiResult<T> = { ok: true, data };
  res.json(body);
}

export function fail(res: Response, status: number, message: string, code?: string): void {
  const body: ApiResult<never> = { ok: false, error: { code, message } };
  res.status(status).json(body);
}
