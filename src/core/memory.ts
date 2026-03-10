import Database from "better-sqlite3";
import { env } from "../config/env.js";
import type { MarketingStrategy, GeneratedContent, AgentMessage } from "../types/index.js";

let db: Database.Database;

export function initDatabase(): Database.Database {
  db = new Database(env.DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS strategies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS generated_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      strategy_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      keywords TEXT NOT NULL,
      pillar TEXT NOT NULL,
      platform TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (strategy_id) REFERENCES strategies(id)
    );

    CREATE TABLE IF NOT EXISTS conversation_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      strategy_id INTEGER,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS brand_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      strategy_id INTEGER NOT NULL,
      asset_type TEXT NOT NULL,
      asset_url TEXT,
      asset_data TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (strategy_id) REFERENCES strategies(id)
    );
  `);

  return db;
}

export function getDb(): Database.Database {
  if (!db) initDatabase();
  return db;
}

// ─── Strategy CRUD ───

export function saveStrategy(strategy: MarketingStrategy): number {
  const d = getDb();
  const stmt = d.prepare(`
    INSERT INTO strategies (company_name, data, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(
    strategy.companyName,
    JSON.stringify(strategy),
    strategy.createdAt,
    strategy.updatedAt
  );
  return Number(result.lastInsertRowid);
}

export function updateStrategy(id: number, strategy: MarketingStrategy): void {
  const d = getDb();
  strategy.updatedAt = new Date().toISOString();
  d.prepare(`UPDATE strategies SET data = ?, updated_at = ? WHERE id = ?`)
    .run(JSON.stringify(strategy), strategy.updatedAt, id);
}

export function getStrategy(id: number): MarketingStrategy | null {
  const d = getDb();
  const row = d.prepare("SELECT data FROM strategies WHERE id = ?").get(id) as { data: string } | undefined;
  if (!row) return null;
  const strategy = JSON.parse(row.data) as MarketingStrategy;
  strategy.id = id;
  return strategy;
}

export function getLatestStrategy(): MarketingStrategy | null {
  const d = getDb();
  const row = d.prepare("SELECT id, data FROM strategies ORDER BY id DESC LIMIT 1").get() as { id: number; data: string } | undefined;
  if (!row) return null;
  const strategy = JSON.parse(row.data) as MarketingStrategy;
  strategy.id = row.id;
  return strategy;
}

export function listStrategies(): { id: number; companyName: string; createdAt: string }[] {
  const d = getDb();
  return d.prepare("SELECT id, company_name as companyName, created_at as createdAt FROM strategies ORDER BY id DESC").all() as { id: number; companyName: string; createdAt: string }[];
}

// ─── Content CRUD ───

export function saveContent(content: GeneratedContent): number {
  const d = getDb();
  const stmt = d.prepare(`
    INSERT INTO generated_content (strategy_id, type, title, body, keywords, pillar, platform, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    content.strategyId,
    content.type,
    content.title,
    content.body,
    JSON.stringify(content.keywords),
    content.pillar,
    content.platform,
    content.createdAt
  );
  return Number(result.lastInsertRowid);
}

export function getContentByStrategy(strategyId: number, type?: string): GeneratedContent[] {
  const d = getDb();
  let sql = "SELECT * FROM generated_content WHERE strategy_id = ?";
  const params: unknown[] = [strategyId];
  if (type) {
    sql += " AND type = ?";
    params.push(type);
  }
  sql += " ORDER BY created_at DESC";
  const rows = d.prepare(sql).all(...params) as Array<{
    id: number; strategy_id: number; type: string; title: string;
    body: string; keywords: string; pillar: string; platform: string; created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    strategyId: r.strategy_id,
    type: r.type as GeneratedContent["type"],
    title: r.title,
    body: r.body,
    keywords: JSON.parse(r.keywords),
    pillar: r.pillar,
    platform: r.platform,
    createdAt: r.created_at,
  }));
}

// ─── Conversation History ───

export function saveMessage(msg: AgentMessage, strategyId?: number): void {
  const d = getDb();
  d.prepare(`INSERT INTO conversation_history (strategy_id, role, content, timestamp) VALUES (?, ?, ?, ?)`)
    .run(strategyId ?? null, msg.role, msg.content, msg.timestamp);
}

export function getConversationHistory(limit = 50, strategyId?: number): AgentMessage[] {
  const d = getDb();
  let sql = "SELECT role, content, timestamp FROM conversation_history";
  const params: unknown[] = [];
  if (strategyId) {
    sql += " WHERE strategy_id = ?";
    params.push(strategyId);
  }
  sql += " ORDER BY id DESC LIMIT ?";
  params.push(limit);
  const rows = d.prepare(sql).all(...params) as AgentMessage[];
  return rows.reverse();
}

export function closeDatabase(): void {
  if (db) db.close();
}
