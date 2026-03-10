const express = require('express');
const router = express.Router();
const { fetchGoldPrice, getLatestPrice, getPriceHistory } = require('../services/goldService');
const { fetchAllNews, getRecentEvents } = require('../services/newsService');
const { generatePrediction, verifyPredictions, getAccuracyStats, getRecentPredictions } = require('../services/predictionService');
const db = require('../db/init');

// GET /api/gold/price - 获取当前金价
router.get('/price', async (req, res) => {
  try {
    const price = await fetchGoldPrice();
    const latest = getLatestPrice();
    res.json({ success: true, data: latest });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/gold/history - 金价历史
router.get('/history', (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const history = getPriceHistory(days);
  res.json({ success: true, data: history });
});

// GET /api/events - 获取近期事件
router.get('/events', async (req, res) => {
  const days = parseInt(req.query.days) || 7;
  let events = getRecentEvents(days);

  // 如果没有数据则先抓取
  if (events.length === 0) {
    await fetchAllNews();
    events = getRecentEvents(days);
  }

  res.json({ success: true, data: events });
});

// POST /api/events/refresh - 手动刷新新闻
router.post('/events/refresh', async (req, res) => {
  try {
    const events = await fetchAllNews();
    res.json({ success: true, message: `获取到 ${events.length} 条相关事件`, data: events });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/predictions/generate - 为事件生成预测
router.post('/predictions/generate', async (req, res) => {
  const { eventId } = req.body;
  if (!eventId) return res.status(400).json({ success: false, error: 'eventId required' });

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

  const prediction = await generatePrediction(event);
  res.json({ success: true, data: prediction });
});

// POST /api/predictions/auto - 自动为最新事件批量生成预测
router.post('/predictions/auto', async (req, res) => {
  try {
    await fetchAllNews();
    const events = getRecentEvents(1); // 最近1天的事件

    // 只对还没有预测的事件生成预测
    const unpredicted = events.filter(e => {
      const existing = db.prepare('SELECT id FROM predictions WHERE event_id = ?').get(e.id);
      return !existing;
    });

    const results = [];
    for (const event of unpredicted.slice(0, 10)) { // 一次最多10个
      const pred = await generatePrediction(event);
      if (pred) results.push(pred);
    }

    res.json({ success: true, message: `生成了 ${results.length} 个预测`, data: results });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/predictions - 获取预测列表
router.get('/predictions', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const predictions = getRecentPredictions(limit);
  res.json({ success: true, data: predictions });
});

// POST /api/predictions/verify - 手动触发验证
router.post('/predictions/verify', async (req, res) => {
  try {
    await verifyPredictions();
    const stats = getAccuracyStats();
    res.json({ success: true, message: '验证完成', stats });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/stats - 准确率统计
router.get('/stats', (req, res) => {
  const stats = getAccuracyStats();
  res.json({ success: true, data: stats });
});

// GET /api/dashboard - 一次性获取首页所需所有数据
router.get('/dashboard', async (req, res) => {
  try {
    const latest = getLatestPrice();
    const history = getPriceHistory(7);
    const events = getRecentEvents(7);
    const predictions = getRecentPredictions(15);
    const stats = getAccuracyStats();

    res.json({
      success: true,
      data: { latest, history, events, predictions, stats }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
