import { Router } from 'express';
import { db } from './db.js';
import { repo } from './repository.js';
import { attemptFilling, attemptRecheck, assertModifiable, deliveryBlocked } from './rules.js';
import { ok, fail } from './http.js';
import { seedIfEmpty } from './seed.js';

export const router = Router();

// ---------------- cylinders ----------------
router.get('/cylinders', (_req, res) => {
  ok(res, repo.listCylinders());
});

router.get('/cylinders/:code', (req, res) => {
  const c = repo.getCylinder(req.params.code);
  if (!c) return fail(res, 404, '钢瓶不存在');
  ok(res, c);
});

router.post('/cylinders', (req, res) => {
  const b = req.body ?? {};
  if (!b.cylinder_code || b.target_weight == null) {
    return fail(res, 400, '缺少必填字段: cylinder_code / target_weight');
  }
  if (repo.getCylinder(b.cylinder_code)) {
    return fail(res, 409, '钢瓶编码已存在');
  }
  ok(res, repo.createCylinder({
    cylinder_code: b.cylinder_code,
    spec: b.spec ?? 'YSP-15',
    target_weight: Number(b.target_weight),
    tolerance: b.tolerance != null ? Number(b.tolerance) : 0.3,
    inspection_date: b.inspection_date ?? null,
    inspection_expiry: b.inspection_expiry ?? null,
  }));
});

router.put('/cylinders/:code/inspection', (req, res) => {
  const b = req.body ?? {};
  if (!b.inspection_date || !b.inspection_expiry) {
    return fail(res, 400, '缺少 inspection_date / inspection_expiry');
  }
  const c = repo.updateInspection(req.params.code, b.inspection_date, b.inspection_expiry);
  if (!c) return fail(res, 404, '钢瓶不存在');
  ok(res, c);
});

// ---------------- filling ----------------
router.get('/filling', (req, res) => {
  ok(res, repo.listFillings({
    status: typeof req.query.status === 'string' ? req.query.status : undefined,
    code: typeof req.query.code === 'string' ? req.query.code : undefined,
  }));
});

router.post('/filling', (req, res) => {
  const b = req.body ?? {};
  if (!b.cylinder_code || b.filling_weight == null || !b.operator || !b.station) {
    return fail(res, 400, '缺少必填字段: cylinder_code / filling_weight / operator / station');
  }
  const outcome = attemptFilling(
    String(b.cylinder_code),
    Number(b.filling_weight),
    String(b.operator),
    String(b.station),
  );
  if (outcome.kind === 'not_found') return fail(res, 404, '钢瓶不存在');
  if (outcome.kind === 'blocked') {
    return fail(res, 422, outcome.message, outcome.code);
  }
  ok(res, outcome.record);
});

router.post('/filling/:id/recheck', (req, res) => {
  const id = Number(req.params.id);
  const weight = Number(req.body?.weight);
  if (!Number.isFinite(weight)) return fail(res, 400, '缺少复称重量 weight');
  const outcome = attemptRecheck(id, weight);
  if (outcome.kind === 'not_found') return fail(res, 404, '充装记录不存在');
  if (outcome.kind === 'blocked') return fail(res, 422, outcome.message, outcome.code);
  ok(res, outcome.record);
});

router.put('/filling/:id', (req, res) => {
  const id = Number(req.params.id);
  const check = assertModifiable(id);
  if (check.kind === 'not_found') return fail(res, 404, '充装记录不存在');
  if (check.kind === 'blocked') return fail(res, 422, check.message, check.code);
  const b = req.body ?? {};
  if (b.filling_weight == null) return fail(res, 400, '缺少修改字段');
  const outcome = attemptRecheck(id, Number(b.filling_weight));
  if (outcome.kind === 'ok') return ok(res, outcome.record);
  fail(res, 500, '修改失败');
});

// ---------------- delivery ----------------
router.get('/delivery', (_req, res) => {
  ok(res, repo.listDeliveries());
});

router.post('/delivery', (req, res) => {
  const b = req.body ?? {};
  if (!b.cylinder_code || !b.delivery_person || !b.destination) {
    return fail(res, 400, '缺少必填字段: cylinder_code / delivery_person / destination');
  }
  const filling = repo.latestFillingForCode(String(b.cylinder_code));
  if (!filling) return fail(res, 404, '该钢瓶尚无充装记录，不能配送');
  if (filling.delivered === 1) return fail(res, 422, '该钢瓶已配送，不能重复配送', 'RECORD_LOCKED_DELIVERED');
  const block = deliveryBlocked(filling);
  if (block) return fail(res, 422, block.message, block.code);
  const delivery = repo.createDelivery({
    cylinder_code: filling.cylinder_code,
    filling_id: filling.id,
    delivery_person: String(b.delivery_person),
    destination: String(b.destination),
    recipient: b.recipient ?? null,
  });
  repo.markDelivered(filling.id);
  ok(res, delivery);
});

// ---------------- inspect ----------------
router.get('/inspect', (_req, res) => {
  ok(res, repo.listInspections());
});

router.post('/inspect', (req, res) => {
  const b = req.body ?? {};
  if (!b.cylinder_code || !b.inspector || !b.result) {
    return fail(res, 400, '缺少必填字段: cylinder_code / inspector / result');
  }
  if (!['pass', 'abnormal', 'seized'].includes(b.result)) {
    return fail(res, 400, 'result 取值非法');
  }
  ok(res, repo.createInspection({
    cylinder_code: String(b.cylinder_code),
    inspector: String(b.inspector),
    result: b.result,
    remark: b.remark ?? null,
  }));
});

// ---------------- trace ----------------
router.get('/trace/:code', (req, res) => {
  const t = repo.getTrace(req.params.code);
  if (!t) return fail(res, 404, '钢瓶不存在');
  ok(res, t);
});

// ---------------- anomalies & stats ----------------
router.get('/anomalies', (req, res) => {
  const limit = Number(req.query.limit ?? 100);
  ok(res, repo.listAnomalies(limit));
});

router.get('/stats', (_req, res) => {
  ok(res, repo.getStats());
});

// ---------------- demo / seed ----------------
router.post('/demo/seed', (_req, res) => {
  seedIfEmpty();
  ok(res, { seeded: true });
});

router.post('/demo/reset', (_req, res) => {
  db.exec(`
    DELETE FROM anomaly_logs;
    DELETE FROM inspections;
    DELETE FROM delivery_records;
    DELETE FROM filling_records;
    DELETE FROM cylinders;
  `);
  seedIfEmpty();
  ok(res, { reset: true });
});
