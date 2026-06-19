import { repo } from './repository.js';
import { db } from './db.js';

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function seedIfEmpty(): void {
  const existing = (db.prepare('SELECT COUNT(*) AS c FROM cylinders').get() as { c: unknown }).c;
  if (Number(existing) > 0) return;

  const defs = [
    {
      code: 'LPG-2025-0001',
      spec: 'YSP-15',
      target: 15.0,
      tol: 0.3,
      insp: dateOffset(-200),
      exp: dateOffset(165),
    },
    {
      code: 'LPG-2025-0002',
      spec: 'YSP-15',
      target: 15.0,
      tol: 0.3,
      insp: dateOffset(-400),
      exp: dateOffset(-35),
    },
    {
      code: 'LPG-2025-0003',
      spec: 'YSP-50',
      target: 50.0,
      tol: 0.5,
      insp: dateOffset(-120),
      exp: dateOffset(245),
    },
    {
      code: 'LPG-2025-0004',
      spec: 'YSP-15',
      target: 15.0,
      tol: 0.3,
      insp: dateOffset(-300),
      exp: dateOffset(65),
    },
    {
      code: 'LPG-2025-0005',
      spec: 'YSP-15',
      target: 15.0,
      tol: 0.3,
      insp: null,
      exp: null,
    },
  ];

  for (const d of defs) {
    repo.createCylinder({
      cylinder_code: d.code,
      spec: d.spec,
      target_weight: d.target,
      tolerance: d.tol,
      inspection_date: d.insp,
      inspection_expiry: d.exp,
    });
  }

  const c4 = repo.getCylinder('LPG-2025-0004');
  if (c4) {
    const fr = repo.createFilling({
      cylinder_code: 'LPG-2025-0004',
      station: '城东充装站',
      operator: '王充装',
      target_weight: c4.target_weight,
      filling_weight: 15.05,
      weight_diff: 0.05,
      status: 'normal',
    });
    repo.createDelivery({
      cylinder_code: 'LPG-2025-0004',
      filling_id: fr.id,
      delivery_person: '李配送',
      destination: '幸福小区12-3',
      recipient: '张三',
    });
    repo.markDelivered(fr.id);
  }
}
