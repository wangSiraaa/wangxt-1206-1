-- 气瓶追溯系统增强 - 称重复核与异常瓶锁定

ALTER TABLE cylinders ADD COLUMN locked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cylinders ADD COLUMN lock_reason TEXT;
ALTER TABLE cylinders ADD COLUMN locked_at TEXT;

ALTER TABLE filling_records ADD COLUMN recheck_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE filling_records ADD COLUMN first_weight REAL;
ALTER TABLE filling_records ADD COLUMN second_weight REAL;

CREATE TABLE IF NOT EXISTS spot_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cylinder_code TEXT NOT NULL,
  filling_id INTEGER NOT NULL,
  inspector TEXT NOT NULL,
  result TEXT NOT NULL,
  remark TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (filling_id) REFERENCES filling_records(id)
);
CREATE INDEX IF NOT EXISTS idx_spot_code ON spot_checks(cylinder_code);
CREATE INDEX IF NOT EXISTS idx_spot_filling ON spot_checks(filling_id);

CREATE TABLE IF NOT EXISTS cylinder_locks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cylinder_code TEXT NOT NULL,
  lock_type TEXT NOT NULL,
  lock_reason TEXT NOT NULL,
  operator TEXT,
  filling_id INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lock_code ON cylinder_locks(cylinder_code);
