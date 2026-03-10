const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/gold.db');
const fs = require('fs');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// 初始化表结构
db.exec(`
  CREATE TABLE IF NOT EXISTS gold_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    price REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    summary TEXT,
    source TEXT,
    url TEXT,
    published_at DATETIME,
    impact_keywords TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER,
    prediction TEXT NOT NULL,        -- 'up' | 'down' | 'neutral'
    confidence INTEGER DEFAULT 50,   -- 0~100
    reasoning TEXT,
    gold_price_at_prediction REAL,
    gold_price_verified REAL,
    is_correct INTEGER,              -- 0 | 1 | NULL(待验证)
    predicted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    verified_at DATETIME,
    verify_after_hours INTEGER DEFAULT 24,
    FOREIGN KEY(event_id) REFERENCES events(id)
  );

  CREATE TABLE IF NOT EXISTS accuracy_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    total_predictions INTEGER DEFAULT 0,
    correct_predictions INTEGER DEFAULT 0,
    accuracy_rate REAL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  INSERT OR IGNORE INTO accuracy_stats (id, total_predictions, correct_predictions, accuracy_rate)
  VALUES (1, 0, 0, 0);
`);

module.exports = db;
