/**
 * 预测服务：基于关键词规则 + 可选AI分析，生成金价预测
 */
const db = require('../db/init');
const { getLatestPrice } = require('./goldService');
const axios = require('axios');
require('dotenv').config();

// 看涨关键词（金价上涨信号）
const BULLISH_SIGNALS = [
  'war', 'conflict', 'attack', 'invasion', 'sanctions', 'crisis', 'recession',
  'inflation', 'rate cut', 'dovish', 'unemployment', 'debt ceiling', 'default',
  'geopolitical', 'risk', 'safe haven', 'uncertainty', 'fear', 'tension',
  'collapse', 'bank failure', 'financial crisis', 'economic slowdown'
];

// 看跌关键词（金价下跌信号）
const BEARISH_SIGNALS = [
  'rate hike', 'hawkish', 'strong dollar', 'economic growth', 'recovery',
  'deal', 'ceasefire', 'peace', 'resolution', 'stability', 'surplus',
  'bull market', 'stock rally', 'risk on', 'optimism', 'positive GDP'
];

function analyzeByRules(title, summary, keywords) {
  const text = `${title} ${summary} ${keywords}`.toLowerCase();
  let bullishScore = 0;
  let bearishScore = 0;

  BULLISH_SIGNALS.forEach(signal => {
    if (text.includes(signal)) bullishScore++;
  });

  BEARISH_SIGNALS.forEach(signal => {
    if (text.includes(signal)) bearishScore++;
  });

  let prediction, confidence, reasoning;

  if (bullishScore > bearishScore) {
    prediction = 'up';
    confidence = Math.min(50 + bullishScore * 8, 85);
    reasoning = `检测到 ${bullishScore} 个看涨信号（${BULLISH_SIGNALS.filter(s => text.includes(s)).join(', ')}），预计金价上涨`;
  } else if (bearishScore > bullishScore) {
    prediction = 'down';
    confidence = Math.min(50 + bearishScore * 8, 85);
    reasoning = `检测到 ${bearishScore} 个看跌信号（${BEARISH_SIGNALS.filter(s => text.includes(s)).join(', ')}），预计金价下跌`;
  } else {
    prediction = 'neutral';
    confidence = 40;
    reasoning = '信号混合，预计金价震荡为主';
  }

  return { prediction, confidence, reasoning };
}

async function analyzeByAI(title, summary) {
  if (!process.env.OPENAI_API_KEY) return null;

  try {
    const prompt = `你是一位黄金市场分析师。根据以下国际新闻事件，判断对国际金价（XAUUSD）在未来24小时内的影响方向。
    
事件标题：${title}
事件摘要：${summary}

请用JSON格式回答：
{
  "prediction": "up" | "down" | "neutral",
  "confidence": 0-100的整数,
  "reasoning": "简短分析原因（50字以内）"
}

只返回JSON，不要其他内容。`;

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 200
    }, {
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      timeout: 10000
    });

    const result = JSON.parse(response.data.choices[0].message.content.trim());
    return result;
  } catch (e) {
    console.error('[AI] Analysis failed:', e.message);
    return null;
  }
}

async function generatePrediction(event) {
  const currentPrice = getLatestPrice();
  if (!currentPrice) return null;

  // 优先AI分析，失败则用规则
  let analysis = await analyzeByAI(event.title, event.summary || '');
  if (!analysis) {
    analysis = analyzeByRules(event.title, event.summary || '', event.impact_keywords || '');
  }

  const prediction = db.prepare(`
    INSERT INTO predictions (event_id, prediction, confidence, reasoning, gold_price_at_prediction, verify_after_hours)
    VALUES (?, ?, ?, ?, ?, 24)
  `).run(event.id, analysis.prediction, analysis.confidence, analysis.reasoning, currentPrice.price);

  return { id: prediction.lastInsertRowid, ...analysis, price: currentPrice.price };
}

async function verifyPredictions() {
  const { fetchGoldPrice } = require('./goldService');
  const currentPrice = await fetchGoldPrice();
  if (!currentPrice) return;

  // 找出超过verify_after_hours但还未验证的预测
  const pending = db.prepare(`
    SELECT p.*, e.title FROM predictions p
    LEFT JOIN events e ON p.event_id = e.id
    WHERE p.is_correct IS NULL
    AND p.gold_price_at_prediction IS NOT NULL
    AND datetime(p.predicted_at, '+' || p.verify_after_hours || ' hours') <= datetime('now')
  `).all();

  for (const pred of pending) {
    const priceDiff = currentPrice - pred.gold_price_at_prediction;
    const changePercent = Math.abs(priceDiff) / pred.gold_price_at_prediction * 100;

    let actualDirection;
    if (changePercent < 0.1) actualDirection = 'neutral'; // 变动小于0.1%视为持平
    else if (priceDiff > 0) actualDirection = 'up';
    else actualDirection = 'down';

    const isCorrect = pred.prediction === actualDirection ? 1 : 0;

    db.prepare(`
      UPDATE predictions SET
        gold_price_verified = ?,
        is_correct = ?,
        verified_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(currentPrice, isCorrect, pred.id);

    console.log(`[Verify] Prediction #${pred.id}: ${pred.prediction} vs actual ${actualDirection} → ${isCorrect ? '✅' : '❌'}`);
  }

  // 更新准确率统计
  const stats = db.prepare(`
    SELECT COUNT(*) as total, SUM(is_correct) as correct
    FROM predictions WHERE is_correct IS NOT NULL
  `).get();

  const rate = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;

  db.prepare(`
    UPDATE accuracy_stats SET
      total_predictions = ?,
      correct_predictions = ?,
      accuracy_rate = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run(stats.total, stats.correct || 0, rate);
}

function getAccuracyStats() {
  return db.prepare('SELECT * FROM accuracy_stats WHERE id = 1').get();
}

function getRecentPredictions(limit = 20) {
  return db.prepare(`
    SELECT p.*, e.title as event_title, e.source as event_source, e.url as event_url, e.published_at as event_published_at
    FROM predictions p
    LEFT JOIN events e ON p.event_id = e.id
    ORDER BY p.predicted_at DESC
    LIMIT ?
  `).all(limit);
}

module.exports = { generatePrediction, verifyPredictions, getAccuracyStats, getRecentPredictions };
