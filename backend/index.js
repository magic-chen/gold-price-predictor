require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());

// 静态文件（前端 build 后放这里）
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// API 路由
app.use('/api', require('./routes/api'));

// 其他路由返回前端 index.html（SPA 支持）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// 定时任务
const { fetchGoldPrice } = require('./services/goldService');
const { fetchAllNews } = require('./services/newsService');
const { verifyPredictions } = require('./services/predictionService');

// 每小时抓取一次金价
cron.schedule('0 * * * *', async () => {
  console.log('[Cron] Fetching gold price...');
  await fetchGoldPrice();
});

// 每6小时抓取一次新闻
cron.schedule('0 */6 * * *', async () => {
  console.log('[Cron] Fetching news...');
  await fetchAllNews();
});

// 每天验证一次预测
cron.schedule('30 8 * * *', async () => {
  console.log('[Cron] Verifying predictions...');
  await verifyPredictions();
});

// 启动时先初始化数据
async function init() {
  try {
    console.log('[Init] Fetching initial gold price...');
    await fetchGoldPrice();
    console.log('[Init] Fetching initial news...');
    await fetchAllNews();
    console.log('[Init] Done.');
  } catch (e) {
    console.error('[Init] Error:', e.message);
  }
}

app.listen(PORT, () => {
  console.log(`🚀 Gold Predictor backend running on port ${PORT}`);
  init();
});

module.exports = app;
