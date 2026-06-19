import { db, nowISO } from './db.js';
import type {
  Cylinder,
  FillingRecord,
  DeliveryRecord,
  Inspection,
  AnomalyLog,
  FillingStatus,
  InspectionResult,
  BlockCode,
  TraceRecord,
  Stats,
} from '../shared/types.js';

type Row = Record<string, unknown>;

function rowToCylinder(r: Row): Cylinder {
  return {
    id: Number(r.id),
    cylinder_code: String(r.cylinder_code),
    spec: String(r.spec),
    target_weight: Number(r.target_weight),
    tolerance: Number(r.tolerance),
    inspection_date: (r.inspection_date as string | null) ?? null,
    inspection_expiry: (r.inspection_expiry as string | null) ?? null,
    created_at: String(r.created_at),
  };
}

function rowToFilling(r: Row): FillingRecord {
  return {
    id: Number(r.id),
    cylinder_code: String(r.cylinder_code),
    station: String(r.station),
    operator: String(r.operator),
    target_weight: Number(r.target_weight),
    filling_weight: r.filling_weight == null ? null : Number(r.filling_weight),
    weight_diff: r.weight_diff == null ? null : Number(r.weight_diff),
    status: String(r.status) as FillingStatus,
    delivered: Number(r.delivered),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

function rowToDelivery(r: Row): DeliveryRecord {
  return {
    id: Number(r.id),
    cylinder_code: String(r.cylinder_code),
    filling_id: Number(r.filling_id),
    delivery_person: String(r.delivery_person),
    destination: String(r.destination),
    recipient: (r.recipient as string | null) ?? null,
    delivered_at: String(r.delivered_at),
  };
}

function rowToInspection(r: Row): Inspection {
  return {
    id: Number(r.id),
    cylinder_code: String(r.cylinder_code),
    inspector: String(r.inspector),
    result: String(r.result) as InspectionResult,
    remark: (r.remark as string | null) ?? null,
    inspected_at: String(r.inspected_at),
  };
}

function rowToAnomaly(r: Row): AnomalyLog {
  return {
    id: Number(r.id),
    block_code: String(r.block_code) as BlockCode,
    cylinder_code: (r.cylinder_code as string | null) ?? null,
    detail: String(r.detail),
    operator: (r.operator as string | null) ?? null,
    created_at: String(r.created_at),
  };
}

export const repo = {
  // ---- cylinders ----
  getCylinder(code: string): Cylinder | undefined {
    const row = db.prepare('SELECT * FROM cylinders WHERE cylinder_code = ?').get(code) as Row | undefined;
    return row ? rowToCylinder(row) : undefined;
  },
  listCylinders(): Cylinder[] {
    const rows = db.prepare('SELECT * FROM cylinders ORDER BY id ASC').all() as Row[];
    return rows.map(rowToCylinder);
  },
  createCylinder(c: {
    cylinder_code: string;
    spec: string;
    target_weight: number;
    tolerance: number;
    inspection_date: string | null;
    inspection_expiry: string | null;
  }): Cylinder {
    const res = db
      .prepare(
        `INSERT INTO cylinders (cylinder_code, spec, target_weight, tolerance, inspection_date, inspection_expiry, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        c.cylinder_code,
        c.spec,
        c.target_weight,
        c.tolerance,
        c.inspection_date,
        c.inspection_expiry,
        nowISO(),
      );
    const row = db.prepare('SELECT * FROM cylinders WHERE id = ?').get(Number(res.lastInsertRowid)) as Row;
    return rowToCylinder(row);
  },
  updateInspection(code: string, inspectionDate: string, expiry: string): Cylinder | undefined {
    db.prepare(
      'UPDATE cylinders SET inspection_date = ?, inspection_expiry = ? WHERE cylinder_code = ?',
    ).run(inspectionDate, expiry, code);
    return repo.getCylinder(code);
  },

  // ---- filling ----
  createFilling(data: {
    cylinder_code: string;
    station: string;
    operator: string;
    target_weight: number;
    filling_weight: number;
    weight_diff: number;
    status: FillingStatus;
  }): FillingRecord {
    const ts = nowISO();
    const res = db
      .prepare(
        `INSERT INTO filling_records
         (cylinder_code, station, operator, target_weight, filling_weight, weight_diff, status, delivered, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      )
      .run(
        data.cylinder_code,
        data.station,
        data.operator,
        data.target_weight,
        data.filling_weight,
        data.weight_diff,
        data.status,
        ts,
        ts,
      );
    const row = db.prepare('SELECT * FROM filling_records WHERE id = ?').get(Number(res.lastInsertRowid)) as Row;
    return rowToFilling(row);
  },
  getFilling(id: number): FillingRecord | undefined {
    const row = db.prepare('SELECT * FROM filling_records WHERE id = ?').get(id) as Row | undefined;
    return row ? rowToFilling(row) : undefined;
  },
  latestFillingForCode(code: string): FillingRecord | undefined {
    const row = db
      .prepare('SELECT * FROM filling_records WHERE cylinder_code = ? ORDER BY id DESC LIMIT 1')
      .get(code) as Row | undefined;
    return row ? rowToFilling(row) : undefined;
  },
  listFillings(filter: { status?: string; code?: string }): FillingRecord[] {
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (filter.status) {
      where.push('status = ?');
      params.push(filter.status);
    }
    if (filter.code) {
      where.push('cylinder_code LIKE ?');
      params.push(`%${filter.code}%`);
    }
    const sql = `SELECT * FROM filling_records ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC`;
    const rows = db.prepare(sql).all(...params) as Row[];
    return rows.map(rowToFilling);
  },
  updateFillingWeight(id: number, weight: number, diff: number, status: FillingStatus): FillingRecord | undefined {
    db.prepare(
      `UPDATE filling_records SET filling_weight = ?, weight_diff = ?, status = ?, updated_at = ? WHERE id = ?`,
    ).run(weight, diff, status, nowISO(), id);
    return repo.getFilling(id);
  },
  markDelivered(id: number): void {
    db.prepare('UPDATE filling_records SET delivered = 1, updated_at = ? WHERE id = ?').run(nowISO(), id);
  },
  deliveryForFilling(fillingId: number): DeliveryRecord | undefined {
    const row = db
      .prepare('SELECT * FROM delivery_records WHERE filling_id = ? ORDER BY id DESC LIMIT 1')
      .get(fillingId) as Row | undefined;
    return row ? rowToDelivery(row) : undefined;
  },

  // ---- delivery ----
  createDelivery(data: {
    cylinder_code: string;
    filling_id: number;
    delivery_person: string;
    destination: string;
    recipient: string | null;
  }): DeliveryRecord {
    const res = db
      .prepare(
        `INSERT INTO delivery_records (cylinder_code, filling_id, delivery_person, destination, recipient, delivered_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        data.cylinder_code,
        data.filling_id,
        data.delivery_person,
        data.destination,
        data.recipient,
        nowISO(),
      );
    const row = db.prepare('SELECT * FROM delivery_records WHERE id = ?').get(Number(res.lastInsertRowid)) as Row;
    return rowToDelivery(row);
  },
  listDeliveries(): DeliveryRecord[] {
    const rows = db.prepare('SELECT * FROM delivery_records ORDER BY id DESC').all() as Row[];
    return rows.map(rowToDelivery);
  },

  // ---- inspections ----
  createInspection(data: {
    cylinder_code: string;
    inspector: string;
    result: InspectionResult;
    remark: string | null;
  }): Inspection {
    const res = db
      .prepare(
        `INSERT INTO inspections (cylinder_code, inspector, result, remark, inspected_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(data.cylinder_code, data.inspector, data.result, data.remark, nowISO());
    const row = db.prepare('SELECT * FROM inspections WHERE id = ?').get(Number(res.lastInsertRowid)) as Row;
    return rowToInspection(row);
  },
  listInspections(): Inspection[] {
    const rows = db.prepare('SELECT * FROM inspections ORDER BY id DESC').all() as Row[];
    return rows.map(rowToInspection);
  },

  // ---- anomalies ----
  logAnomaly(data: { block_code: BlockCode; cylinder_code: string | null; detail: string; operator: string | null }): AnomalyLog {
    const res = db
      .prepare(
        `INSERT INTO anomaly_logs (block_code, cylinder_code, detail, operator, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(data.block_code, data.cylinder_code, data.detail, data.operator, nowISO());
    const row = db.prepare('SELECT * FROM anomaly_logs WHERE id = ?').get(Number(res.lastInsertRowid)) as Row;
    return rowToAnomaly(row);
  },
  listAnomalies(limit = 100): AnomalyLog[] {
    const rows = db.prepare('SELECT * FROM anomaly_logs ORDER BY id DESC LIMIT ?').all(limit) as Row[];
    return rows.map(rowToAnomaly);
  },
  countAnomalies(): number {
    const row = db.prepare('SELECT COUNT(*) AS c FROM anomaly_logs').get() as Row;
    return Number(row.c);
  },

  // ---- trace ----
  getTrace(code: string): TraceRecord | undefined {
    const cylinder = repo.getCylinder(code);
    if (!cylinder) return undefined;
    const fillings = db.prepare('SELECT * FROM filling_records WHERE cylinder_code = ? ORDER BY id ASC').all(code) as Row[];
    const deliveries = db.prepare('SELECT * FROM delivery_records WHERE cylinder_code = ? ORDER BY id ASC').all(code) as Row[];
    const inspections = db.prepare('SELECT * FROM inspections WHERE cylinder_code = ? ORDER BY id ASC').all(code) as Row[];
    return {
      cylinder,
      fillings: fillings.map(rowToFilling),
      deliveries: deliveries.map(rowToDelivery),
      inspections: inspections.map(rowToInspection),
    };
  },

  // ---- stats ----
  getStats(): Stats {
    const cylinders = Number((db.prepare('SELECT COUNT(*) AS c FROM cylinders').get() as Row).c);
    const fillingsToday = Number(
      (
        db.prepare("SELECT COUNT(*) AS c FROM filling_records WHERE date(created_at) = date('now')").get() as Row
      ).c,
    );
    const inDelivery = Number(
      (db.prepare('SELECT COUNT(*) AS c FROM delivery_records').get() as Row).c,
    );
    const blocked = repo.countAnomalies();
    const totalIns = Number((db.prepare('SELECT COUNT(*) AS c FROM inspections').get() as Row).c);
    const abnormalIns = Number(
      (
        db.prepare("SELECT COUNT(*) AS c FROM inspections WHERE result IN ('abnormal','seized')").get() as Row
      ).c,
    );
    return {
      cylinders,
      fillings_today: fillingsToday,
      in_delivery: inDelivery,
      blocked_count: blocked,
      inspection_abnormal_rate: totalIns === 0 ? 0 : Math.round((abnormalIns / totalIns) * 1000) / 10,
    };
  },
};
