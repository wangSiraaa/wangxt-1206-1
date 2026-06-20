import { repo } from './repository.js';
import { todayISO } from './db.js';
import type { Cylinder, FillingRecord, FillingStatus, BlockCode, LockType } from '../shared/types.js';

export const MAX_RECHECK_COUNT = 2;

export type RuleOutcome =
  | { kind: 'ok'; record: FillingRecord }
  | { kind: 'blocked'; code: BlockCode; message: string; cylinder?: Cylinder }
  | { kind: 'not_found' }
  | { kind: 'locked'; record: FillingRecord };

function isOverdue(c: Cylinder): boolean {
  if (!c.inspection_expiry) return true;
  return c.inspection_expiry < todayISO();
}

function isLocked(c: Cylinder): boolean {
  return c.locked === 1;
}

export function attemptFilling(
  code: string,
  fillingWeight: number,
  operator: string,
  station: string,
): RuleOutcome {
  const cylinder = repo.getCylinder(code);
  if (!cylinder) return { kind: 'not_found' };

  if (isLocked(cylinder)) {
    const msg = cylinder.lock_reason
      ? `该钢瓶已被锁定：${cylinder.lock_reason}，禁止充装`
      : '该钢瓶已被锁定，禁止充装';
    repo.logAnomaly({
      block_code: 'CYLINDER_LOCKED',
      cylinder_code: code,
      detail: msg,
      operator,
    });
    return { kind: 'blocked', code: 'CYLINDER_LOCKED', message: msg, cylinder };
  }

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
      detail: `充装重量 ${fillingWeight}kg，目标 ${cylinder.target_weight}kg，偏差 ${diff > 0 ? '+' : ''}${diff}kg 超出允差 ±${cylinder.tolerance}kg，转入复称（第1次）`,
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

  if (filling.status === 'blocked_weight') {
    const msg = '该充装记录已因复称仍异常被锁定，禁止复称';
    repo.logAnomaly({
      block_code: 'RECHECK_EXCEEDED',
      cylinder_code: filling.cylinder_code,
      detail: msg,
      operator: filling.operator,
    });
    return { kind: 'blocked', code: 'RECHECK_EXCEEDED', message: msg };
  }

  const cylinder = repo.getCylinder(filling.cylinder_code);
  if (!cylinder) return { kind: 'not_found' };

  const newRecheckCount = filling.recheck_count + 1;
  const diff = Math.round((weight - cylinder.target_weight) * 1000) / 1000;
  const withinTol = Math.abs(diff) <= cylinder.tolerance;

  if (!withinTol && newRecheckCount >= MAX_RECHECK_COUNT) {
    const status: FillingStatus = 'blocked_weight';
    const record = repo.updateFillingWeight(id, weight, diff, status, newRecheckCount)!;

    const lockReason = `复称${MAX_RECHECK_COUNT}次仍超差：首次${filling.first_weight ?? filling.filling_weight}kg，末次${weight}kg，允差±${cylinder.tolerance}kg`;
    repo.lockCylinder(filling.cylinder_code, 'WEIGHT' as LockType, lockReason, filling.operator, id);

    repo.logAnomaly({
      block_code: 'RECHECK_EXCEEDED',
      cylinder_code: filling.cylinder_code,
      detail: `复称${newRecheckCount}次仍超差，偏差${diff > 0 ? '+' : ''}${diff}kg，已锁定该钢瓶`,
      operator: filling.operator,
    });

    return { kind: 'locked', record };
  }

  const status: FillingStatus = withinTol ? 'normal' : 'recheck';
  const record = repo.updateFillingWeight(id, weight, diff, status, newRecheckCount)!;

  if (!withinTol) {
    repo.logAnomaly({
      block_code: 'WEIGHT_OUT_OF_TOLERANCE',
      cylinder_code: filling.cylinder_code,
      detail: `第${newRecheckCount}次复称仍超差：重量${weight}kg，偏差${diff > 0 ? '+' : ''}${diff}kg，还可复称${MAX_RECHECK_COUNT - newRecheckCount}次`,
      operator: filling.operator,
    });
  }

  return { kind: 'ok', record };
}

export function assertModifiable(id: number): RuleOutcome {
  const filling = repo.getFilling(id);
  if (!filling) return { kind: 'not_found' };
  if (filling.delivered === 1) {
    const msg = '该充装记录已配送，禁止修改。如需追加检查结论，请使用"抽查"功能。';
    repo.logAnomaly({
      block_code: 'RECORD_LOCKED_DELIVERED',
      cylinder_code: filling.cylinder_code,
      detail: msg,
      operator: filling.operator,
    });
    return { kind: 'blocked', code: 'RECORD_LOCKED_DELIVERED', message: msg };
  }
  if (filling.status === 'blocked_weight') {
    const msg = '该充装记录已因复称超差被锁定，禁止修改';
    return { kind: 'blocked', code: 'RECHECK_EXCEEDED', message: msg };
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
  if (filling.status === 'blocked_weight') {
    const msg = '该充装记录已因复称超差被锁定，禁止配送';
    repo.logAnomaly({
      block_code: 'RECHECK_EXCEEDED',
      cylinder_code: filling.cylinder_code,
      detail: msg,
      operator: filling.operator,
    });
    return { blocked: true, code: 'RECHECK_EXCEEDED', message: msg };
  }
  return null;
}

export function assertCanDeliver(code: string): RuleOutcome {
  const cylinder = repo.getCylinder(code);
  if (!cylinder) return { kind: 'not_found' };
  if (isLocked(cylinder)) {
    const msg = cylinder.lock_reason
      ? `该钢瓶已被锁定：${cylinder.lock_reason}，禁止配送`
      : '该钢瓶已被锁定，禁止配送';
    return { kind: 'blocked', code: 'CYLINDER_LOCKED', message: msg, cylinder };
  }
  const filling = repo.latestFillingForCode(code);
  if (!filling) return { kind: 'not_found' };
  return { kind: 'ok', record: filling };
}
