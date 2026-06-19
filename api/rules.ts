import { repo } from './repository.js';
import { todayISO } from './db.js';
import type { Cylinder, FillingRecord, FillingStatus, BlockCode } from '../shared/types.js';

export type RuleOutcome =
  | { kind: 'ok'; record: FillingRecord }
  | { kind: 'blocked'; code: BlockCode; message: string; cylinder?: Cylinder }
  | { kind: 'not_found' };

function isOverdue(c: Cylinder): boolean {
  if (!c.inspection_expiry) return true;
  return c.inspection_expiry < todayISO();
}

export function attemptFilling(
  code: string,
  fillingWeight: number,
  operator: string,
  station: string,
): RuleOutcome {
  const cylinder = repo.getCylinder(code);
  if (!cylinder) return { kind: 'not_found' };

  if (isOverdue(cylinder)) {
    const msg = cylinder.inspection_expiry
      ? `钢瓶检验已于 ${cylinder.inspection_expiry} 过期，禁止充装`
      : '钢瓶未登记检验信息，禁止充装';
    repo.logAnomaly({
      block_code: 'CYLINDER_OVERDUE',
      cylinder_code: code,
      detail: msg,
      operator,
    });
    return { kind: 'blocked', code: 'CYLINDER_OVERDUE', message: msg, cylinder };
  }

  const diff = Math.round((fillingWeight - cylinder.target_weight) * 1000) / 1000;
  const withinTol = Math.abs(diff) <= cylinder.tolerance;
  const status: FillingStatus = withinTol ? 'normal' : 'recheck';

  const record = repo.createFilling({
    cylinder_code: code,
    station,
    operator,
    target_weight: cylinder.target_weight,
    filling_weight: fillingWeight,
    weight_diff: diff,
    status,
  });

  if (!withinTol) {
    repo.logAnomaly({
      block_code: 'WEIGHT_OUT_OF_TOLERANCE',
      cylinder_code: code,
      detail: `充装重量 ${fillingWeight}kg，目标 ${cylinder.target_weight}kg，偏差 ${diff > 0 ? '+' : ''}${diff}kg 超出允差 ±${cylinder.tolerance}kg，转入复称`,
      operator,
    });
  }

  return { kind: 'ok', record };
}

export function attemptRecheck(id: number, weight: number): RuleOutcome {
  const filling = repo.getFilling(id);
  if (!filling) return { kind: 'not_found' };
  if (filling.delivered === 1) {
    const msg = '该充装记录已配送，禁止修改 / 复称';
    repo.logAnomaly({
      block_code: 'RECORD_LOCKED_DELIVERED',
      cylinder_code: filling.cylinder_code,
      detail: msg,
      operator: filling.operator,
    });
    return { kind: 'blocked', code: 'RECORD_LOCKED_DELIVERED', message: msg };
  }
  const cylinder = repo.getCylinder(filling.cylinder_code);
  if (!cylinder) return { kind: 'not_found' };

  const diff = Math.round((weight - cylinder.target_weight) * 1000) / 1000;
  const withinTol = Math.abs(diff) <= cylinder.tolerance;
  const status: FillingStatus = withinTol ? 'normal' : 'recheck';
  const record = repo.updateFillingWeight(id, weight, diff, status)!;
  return { kind: 'ok', record };
}

export function assertModifiable(id: number): RuleOutcome {
  const filling = repo.getFilling(id);
  if (!filling) return { kind: 'not_found' };
  if (filling.delivered === 1) {
    const msg = '该充装记录已配送，禁止修改';
    repo.logAnomaly({
      block_code: 'RECORD_LOCKED_DELIVERED',
      cylinder_code: filling.cylinder_code,
      detail: msg,
      operator: filling.operator,
    });
    return { kind: 'blocked', code: 'RECORD_LOCKED_DELIVERED', message: msg };
  }
  return { kind: 'ok', record: filling };
}

export function deliveryBlocked(filling: FillingRecord): { blocked: true; code: BlockCode; message: string } | null {
  if (filling.status === 'recheck') {
    const msg = '该充装记录处于复称状态，禁止配送';
    repo.logAnomaly({
      block_code: 'WEIGHT_OUT_OF_TOLERANCE',
      cylinder_code: filling.cylinder_code,
      detail: msg,
      operator: filling.operator,
    });
    return { blocked: true, code: 'WEIGHT_OUT_OF_TOLERANCE', message: msg };
  }
  return null;
}
