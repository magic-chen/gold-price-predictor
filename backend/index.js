require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// ── SSE 客户端管理（Server-Sent Events 实时推送到前端）──
const sseClients = new Set();

app.get('/api/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();
  res.write('data: {"type":"connected"}\n\n');

  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

function broadcastSSE(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    try { client.write(payload); } catch (e) { sseClients.delete(client); }
  });
}

// ── API 路由 ──
app.use('/api', require('./routes/api'));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// ── 服务引入 ──
const { fetchGoldPrice, getLatestPrice } = require('./services/goldService');
const { fetchAllNews, getRecentEvents } = require('./services/newsService');
const { generatePrediction, verifyPredictions, getAccuracyStats } = require('./services/predictionService');
const { sendFeishuMessage, buildPushMessage } = require('./services/pushService');
const db = require('./db/init');

// ── 核心：自动抓取 + 分析 + 推送 ──────────────────────────
async function runCycle(opts = {}) {
  const { silent = false } = opts;
  console.log(`\n[Cycle] ====== 开始执行周期 ${new Date().toLocaleString('zh-CN')} ======`);

  // 1. 拉取最新金价
  const price = await fetchGoldPrice();
  console.log(`[Cycle] 金价: $${price}`);

  // 2. 抓取新闻，找出新增的
  const beforeCount = db.prepare('SELECT COUNT(*) as c FROM events').get().c;
  await fetchAllNews();
  const afterCount = db.prepare('SELECT COUNT(*) as c FROM events').get().c;
  const newCount = afterCount - beforeCount;
  console.log(`[Cycle] 新增事件: ${newCount} 条`);

  // 3. 为新增事件生成预测
  let newEvents = [];
  if (newCount > 0) {
    // 取最新的 newCount 条（刚入库的）
    newEvents = db.prepare(`
      SELECT * FROM events
      ORDER BY created_at DESC
      LIMIT ?
    `).all(Math.min(newCount, 15));

    for (const evt of newEvents) {
      const existing = db.prepare('SELECT id FROM predictions WHERE event_id = ?').get(evt.id);
      if (!existing) {
        await generatePrediction(evt);
      }
    }
    console.log(`[Cycle] 已为 ${newEvents.length} 条新事件生成预测`);
  }

  // 4. 验证昨天的预测
  await verifyPredictions();

  // 5. 通知前端刷新（SSE）
  broadcastSSE({
    type: 'update',
    price,
    newEvents: newCount,
    stats: getAccuracyStats(),
    ts: Date.now()
  });

  // 6. 如果有高影响新事件，推送飞书消息
  if (!silent && newCount > 0) {
    const highImpact = newEvents.filter(e => e.sentiment !== 'neutral');
    if (highImpact.length > 0) {
      const msg = buildPushMessage(highImpact, price);
      await sendFeishuMessage(msg);
      console.log(`[Cycle] 飞书推送完成 (${highImpact.length} 条高影响事件)`);
    }
  }

  console.log(`[Cycle] ====== 周期完成 ======\n`);
}

// ── 定时任务 ──────────────────────────────────────────────
// 每2小时执行一次完整周期
cron.schedule('0 */2 * * *', () => runCycle());

// 每30分钟抓取并存储金价
cron.schedule('*/30 * * * *', async () => {
  const price = await fetchGoldPrice();  // 内部已写库
  broadcastSSE({ type: 'price', price, ts: Date.now() });
  console.log('[Cron/30m] Gold price saved:', price);
});

// 每天早8点跑一次验证
cron.schedule('0 8 * * *', async () => {
  await verifyPredictions();
  broadcastSSE({ type: 'verified', stats: getAccuracyStats(), ts: Date.now() });
});

// ── 启动 ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Gold Predictor running on port ${PORT}`);
  // 启动时：先立即抓一次金价，再跑完整周期
  fetchGoldPrice().then(p => {
    broadcastSSE({ type: 'price', price: p, ts: Date.now() });
    console.log('[Startup] Initial gold price fetched:', p);
  });
  runCycle({ silent: true }).catch(console.error);
});

module.exports = app;
