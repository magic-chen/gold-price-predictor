/**
 * 预测服务 v2：多时间窗口预测 + 自动验证
 * horizons: 4h / 24h / 72h
 * lookback: 24h
 */
const db = require('../db/init');

// 按 horizon 的方向判断阈值（%）
const THRESHOLDS = {
  '4h':  0.25,
  '24h': 0.50,
  '72h': 1.00,
};

// 确保 predictions_v2 表存在
function ensureSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS predictions_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

      decision_time       DATETIME NOT NULL,
      price_at_decision   REAL NOT NULL,

      lookback_hours      INTEGER DEFAULT 24,
      bullish_count       INTEGER DEFAULT 0,
      bearish_count       INTEGER DEFAULT 0,
      neutral_count       INTEGER DEFAULT 0,
      price_change_24h    REAL,

      direction_4h        TEXT,
      direction_24h       TEXT,
      direction_72h       TEXT,
      confidence_4h       REAL,
      confidence_24h      REAL,
      confidence_72h      REAL,

      verify_time_4h      DATETIME,
      actual_price_4h     REAL,
      result_4h           TEXT,

      verify_time_24h     DATETIME,
      actual_price_24h    REAL,
      result_24h          TEXT,

      verify_time_72h     DATETIME,
      actual_price_72h    REAL,
      result_72h          TEXT
    );

    CREATE TABLE IF NOT EXISTS accuracy_v2 (
      horizon  TEXT PRIMARY KEY,
      total    INTEGER DEFAULT 0,
      correct  INTEGER DEFAULT 0,
      rate     REAL    DEFAULT 0
    );

    INSERT OR IGNORE INTO accuracy_v2 (horizon) VALUES ('4h'), ('24h'), ('72h');
  `);
}

// ── 核心预测逻辑 ─────────────────────────────────────────────
function computeScore({ bullish, bearish, momentum24h, momentum4h }) {
  // 事件信号
  const eventScore = bullish - bearish * 1.5;
  // 价格动量
  const momentumScore = (momentum4h * 2) + (momentum24h * 0.5);
  return eventScore + momentumScore;
}

function scoreToDirection(score, confidence) {
  if (score > 0.8)  return { dir: 'up',      conf: Math.min(0.5 + score * 0.05, 0.9) };
  if (score < -0.8) return { dir: 'down',     conf: Math.min(0.5 + Math.abs(score) * 0.05, 0.9) };
  return                    { dir: 'neutral', conf: 0.4 };
}

// ── 生成一次预测 ─────────────────────────────────────────────
async function generatePredictionV2() {
  ensureSchema();

  // 防重：10分钟内已生成则跳过
  const recent = db.prepare(
    `SELECT id FROM predictions_v2 WHERE created_at >= datetime('now', '-10 minutes')`
  ).get();
  if (recent) return null;

  // 当前价格
  const latestRow = db.prepare(
    `SELECT price, fetched_at FROM gold_prices ORDER BY fetched_at DESC LIMIT 1`
  ).get();
  if (!latestRow) return null;
  const price = latestRow.price;

  // 24h 前价格
  const price24hAgo = db.prepare(
    `SELECT price FROM gold_prices
     WHERE fetched_at <= datetime('now', '-23 hours')
     ORDER BY fetched_at DESC LIMIT 1`
  ).get();
  const momentum24h = price24hAgo
    ? ((price - price24hAgo.price) / price24hAgo.price) * 100
    : 0;

  // 4h 前价格
  const price4hAgo = db.prepare(
    `SELECT price FROM gold_prices
     WHERE fetched_at <= datetime('now', '-3 hours 50 minutes')
     ORDER BY fetched_at DESC LIMIT 1`
  ).get();
  const momentum4h = price4hAgo
    ? ((price - price4hAgo.price) / price4hAgo.price) * 100
    : 0;

  // 最近 24h 事件情绪分布
  const sentiments = db.prepare(
    `SELECT sentiment, COUNT(*) as cnt FROM events
     WHERE published_at >= datetime('now', '-24 hours')
     GROUP BY sentiment`
  ).all();
  const counts = { bullish: 0, bearish: 0, neutral: 0 };
  sentiments.forEach(r => { if (counts[r.sentiment] !== undefined) counts[r.sentiment] = r.cnt; });

  // 计算评分
  const score = computeScore({
    bullish: counts.bullish,
    bearish: counts.bearish,
    momentum24h,
    momentum4h,
  });

  const { dir: dir4h,  conf: conf4h  } = scoreToDirection(score);
  // 24h / 72h 用更保守的判断（动量权重降低）
  const score24h = computeScore({ bullish: counts.bullish, bearish: counts.bearish, momentum24h, momentum4h: momentum4h * 0.3 });
  const score72h = computeScore({ bullish: counts.bullish, bearish: counts.bearish, momentum24h: momentum24h * 0.5, momentum4h: 0 });
  const { dir: dir24h, conf: conf24h } = scoreToDirection(score24h);
  const { dir: dir72h, conf: conf72h } = scoreToDirection(score72h);

  const stmt = db.prepare(`
    INSERT INTO predictions_v2
      (decision_time, price_at_decision, lookback_hours,
       bullish_count, bearish_count, neutral_count, price_change_24h,
       direction_4h, direction_24h, direction_72h,
       confidence_4h, confidence_24h, confidence_72h)
    VALUES
      (datetime('now'), ?, 24, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    price,
    counts.bullish, counts.bearish, counts.neutral,
    Math.round(momentum24h * 100) / 100,
    dir4h, dir24h, dir72h,
    Math.round(conf4h * 100) / 100,
    Math.round(conf24h * 100) / 100,
    Math.round(conf72h * 100) / 100,
  );

  console.log(`[PredV2] Generated: 4h=${dir4h}(${(conf4h*100).toFixed(0)}%) 24h=${dir24h} 72h=${dir72h} | score=${score.toFixed(2)}`);
  return { id: result.lastInsertRowid, dir4h, dir24h, dir72h, conf4h, price };
}

// ── 验证到期预测 ─────────────────────────────────────────────
async function verifyPredictionsV2() {
  ensureSchema();

  const horizons = [
    { field: '4h',  hours: 4,  threshold: THRESHOLDS['4h']  },
    { field: '24h', hours: 24, threshold: THRESHOLDS['24h'] },
    { field: '72h', hours: 72, threshold: THRESHOLDS['72h'] },
  ];

  let verified = 0;
  for (const { field, hours, threshold } of horizons) {
    // 找到期且未验证的预测
    const pending = db.prepare(`
      SELECT * FROM predictions_v2
      WHERE result_${field} IS NULL
        AND direction_${field} IS NOT NULL
        AND direction_${field} != 'neutral'
        AND datetime(decision_time, '+${hours} hours') <= datetime('now')
    `).all();

    for (const pred of pending) {
      // 找最接近到期时刻的实际价格
      const actual = db.prepare(`
        SELECT price FROM gold_prices
        WHERE fetched_at >= datetime(?, '+${hours} hours', '-30 minutes')
          AND fetched_at <= datetime(?, '+${hours} hours', '+30 minutes')
        ORDER BY ABS(strftime('%s', fetched_at) - strftime('%s', datetime(?, '+${hours} hours')))
        LIMIT 1
      `).get(pred.decision_time, pred.decision_time, pred.decision_time);

      if (!actual) continue;

      const change = ((actual.price - pred.price_at_decision) / pred.price_at_decision) * 100;
      const predicted = pred[`direction_${field}`];

      let result;
      if (Math.abs(change) < threshold) {
        result = 'neutral'; // 价格没动够，算中性（不计入对错）
      } else if (
        (predicted === 'up'   && change > 0) ||
        (predicted === 'down' && change < 0)
      ) {
        result = 'correct';
      } else {
        result = 'wrong';
      }

      db.prepare(`
        UPDATE predictions_v2
        SET verify_time_${field} = datetime('now'),
            actual_price_${field} = ?,
            result_${field} = ?
        WHERE id = ?
      `).run(actual.price, result, pred.id);

      console.log(`[PredV2] Verified ${field}: pred=${predicted} change=${change.toFixed(2)}% result=${result}`);
      verified++;
    }
  }

  // 更新准确率汇总
  for (const { field } of horizons) {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN result_${field} = 'correct' THEN 1 ELSE 0 END) as correct
      FROM predictions_v2
      WHERE result_${field} IN ('correct', 'wrong')
    `).get();

    const rate = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
    db.prepare(`
      UPDATE accuracy_v2 SET total=?, correct=?, rate=? WHERE horizon=?
    `).run(stats.total, stats.correct, Math.round(rate * 10) / 10, field);
  }

  return verified;
}

// ── 读取最新预测 + 准确率 ────────────────────────────────────
function getLatestPredictionV2() {
  ensureSchema();
  return db.prepare(`
    SELECT * FROM predictions_v2
    ORDER BY decision_time DESC LIMIT 1
  `).get();
}

function getAccuracyV2() {
  ensureSchema();
  return db.prepare(`SELECT * FROM accuracy_v2`).all();
}

// 最近10次预测历史
function getPredictionHistoryV2(limit = 10) {
  ensureSchema();
  return db.prepare(`
    SELECT * FROM predictions_v2
    ORDER BY decision_time DESC LIMIT ?
  `).all(limit);
}

module.exports = {
  generatePredictionV2,
  verifyPredictionsV2,
  getLatestPredictionV2,
  getAccuracyV2,
  getPredictionHistoryV2,
  THRESHOLDS,
};
