import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const dataDir = path.join(rootDir, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'trace.db');

export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

function columnExists(table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((r) => r.name === column);
}

function tableExists(table: string): boolean {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table) as { name: string } | undefined;
  return row !== undefined;
}

function executeMigration(sql: string): void {
  const statements = sql.split(';').map((s) => s.trim()).filter((s) => s.length > 0 && !s.startsWith('--'));
  
  for (const stmt of statements) {
    const alterMatch = stmt.match(/ALTER TABLE (\w+) ADD COLUMN (\w+)/i);
    if (alterMatch) {
      const [, table, column] = alterMatch;
      if (columnExists(table, column)) {
        continue;
      }
    }
    
    try {
      db.exec(stmt);
    } catch (e) {
      const err = e as Error;
      if (err.message.includes('duplicate column name') || 
          err.message.includes('already exists') ||
          err.message.includes('table') && err.message.includes('already exists')) {
        continue;
      }
      throw e;
    }
  }
}

export function initDb(): void {
  const migrationsDir = path.join(rootDir, 'migrations');
  if (!fs.existsSync(migrationsDir)) return;
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
    executeMigration(sql);
  }
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
