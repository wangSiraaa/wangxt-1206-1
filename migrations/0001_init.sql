-- 液化气瓶充装追溯系统 初始化表结构

CREATE TABLE IF NOT EXISTS cylinders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cylinder_code TEXT NOT NULL UNIQUE,
  spec TEXT NOT NULL,
  target_weight REAL NOT NULL,
  tolerance REAL NOT NULL DEFAULT 0.5,
  inspection_date TEXT,
  inspection_expiry TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS filling_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cylinder_code TEXT NOT NULL,
  station TEXT NOT NULL,
  operator TEXT NOT NULL,
  target_weight REAL NOT NULL,
  filling_weight REAL,
  weight_diff REAL,
  status TEXT NOT NULL,
  delivered INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_filling_code ON filling_records(cylinder_code);
CREATE INDEX IF NOT EXISTS idx_filling_status ON filling_records(status);

CREATE TABLE IF NOT EXISTS delivery_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cylinder_code TEXT NOT NULL,
  filling_id INTEGER NOT NULL,
  delivery_person TEXT NOT NULL,
  destination TEXT NOT NULL,
  recipient TEXT,
  delivered_at TEXT NOT NULL,
  FOREIGN KEY (filling_id) REFERENCES filling_records(id)
);
CREATE INDEX IF NOT EXISTS idx_delivery_code ON delivery_records(cylinder_code);

CREATE TABLE IF NOT EXISTS inspections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cylinder_code TEXT NOT NULL,
  inspector TEXT NOT NULL,
  result TEXT NOT NULL,
  remark TEXT,
  inspected_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inspections_code ON inspections(cylinder_code);

CREATE TABLE IF NOT EXISTS anomaly_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  block_code TEXT NOT NULL,
  cylinder_code TEXT,
  detail TEXT NOT NULL,
  operator TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_anomaly_created ON anomaly_logs(created_at);
