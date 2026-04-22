import { createClient, type Client } from "@libsql/client";
import path from "node:path";
import fs from "node:fs";

let _db: Client | null = null;
let _initPromise: Promise<Client> | null = null;

function buildClient(): Client {
  const url       = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (url) {
    return createClient({ url, authToken });
  }

  // Local fallback — file-based SQLite
  const dir      = path.join(process.cwd(), "data");
  const filePath = path.join(dir, "news.db");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return createClient({ url: `file:${filePath}` });
}

export async function getDb(): Promise<Client> {
  if (_db) return _db;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const client = buildClient();
    await initSchema(client);
    await seedIfEmpty(client);
    _db = client;
    return client;
  })();
  return _initPromise;
}

async function initSchema(db: Client) {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS sources (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      source_name     TEXT    NOT NULL UNIQUE,
      tier            TEXT    NOT NULL DEFAULT 'general',
      source_type     TEXT    NOT NULL DEFAULT 'rss',
      url             TEXT,
      is_active       INTEGER NOT NULL DEFAULT 1,
      source_score    INTEGER NOT NULL DEFAULT 1,
      last_collected_at TEXT
    );

    CREATE TABLE IF NOT EXISTS partners (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_name TEXT    NOT NULL UNIQUE,
      is_active    INTEGER NOT NULL DEFAULT 1,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS partner_keywords (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_id   INTEGER NOT NULL,
      partner_name TEXT    NOT NULL,
      keyword      TEXT    NOT NULL,
      keyword_type TEXT    NOT NULL DEFAULT 'official',
      is_active    INTEGER NOT NULL DEFAULT 1,
      UNIQUE(keyword, partner_id)
    );

    CREATE TABLE IF NOT EXISTS scoring_keywords (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword   TEXT    NOT NULL UNIQUE,
      score     INTEGER NOT NULL DEFAULT 2,
      category  TEXT    NOT NULL DEFAULT 'partnership',
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS exclusion_keywords (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword     TEXT    NOT NULL UNIQUE,
      reason      TEXT    NOT NULL DEFAULT 'sports',
      is_override INTEGER NOT NULL DEFAULT 0,
      is_active   INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS articles (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      collected_at     TEXT NOT NULL,
      published_at     TEXT NOT NULL,
      source_name      TEXT NOT NULL,
      source_type      TEXT NOT NULL DEFAULT 'rss',
      title            TEXT NOT NULL,
      summary          TEXT NOT NULL DEFAULT '',
      body_text        TEXT NOT NULL DEFAULT '',
      url              TEXT NOT NULL UNIQUE,
      auto_partners    TEXT NOT NULL DEFAULT '[]',
      manual_partner   TEXT,
      final_partner    TEXT NOT NULL DEFAULT '[]',
      matched_keywords TEXT NOT NULL DEFAULT '[]',
      exclude_keywords TEXT NOT NULL DEFAULT '[]',
      exclude_reason   TEXT,
      source_score     INTEGER NOT NULL DEFAULT 1,
      keyword_score    INTEGER NOT NULL DEFAULT 0,
      partner_score    INTEGER NOT NULL DEFAULT 0,
      spread_score     INTEGER NOT NULL DEFAULT 0,
      total_score      INTEGER NOT NULL DEFAULT 0,
      alert_level      TEXT NOT NULL DEFAULT 'hold',
      status           TEXT NOT NULL DEFAULT 'new',
      note             TEXT,
      is_duplicate     INTEGER NOT NULL DEFAULT 0,
      ai_summary       TEXT,
      ai_impact        TEXT,
      ai_analyzed_at   TEXT
    );

    CREATE TABLE IF NOT EXISTS review_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id  INTEGER NOT NULL,
      field       TEXT    NOT NULL,
      old_value   TEXT,
      new_value   TEXT,
      changed_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_articles_status    ON articles(status);
    CREATE INDEX IF NOT EXISTS idx_articles_alert     ON articles(alert_level);
  `);

  // Migrations for older databases missing AI columns
  const colsRes = await db.execute("PRAGMA table_info(articles)");
  const cols    = colsRes.rows.map((r) => String(r.name));
  if (!cols.includes("ai_summary"))     await db.execute("ALTER TABLE articles ADD COLUMN ai_summary TEXT");
  if (!cols.includes("ai_impact"))      await db.execute("ALTER TABLE articles ADD COLUMN ai_impact TEXT");
  if (!cols.includes("ai_analyzed_at")) await db.execute("ALTER TABLE articles ADD COLUMN ai_analyzed_at TEXT");
}

async function seedIfEmpty(db: Client) {
  // sources 테이블이 비었을 때만 참조 데이터(출처/파트너/키워드)를 시딩합니다.
  // 샘플 기사는 더 이상 자동 시딩하지 않습니다 — 실제 기사는 /api/cron/ingest로 수집합니다.
  const res = await db.execute("SELECT COUNT(*) as n FROM sources");
  const n   = Number(res.rows[0]?.n ?? 0);
  if (n > 0) return;
  const { seedReferenceData } = await import("./seed");
  await seedReferenceData(db);
}
