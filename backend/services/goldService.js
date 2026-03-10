/**
 * 金价服务：通过 GoldAPI 获取实时价格
 */
const axios = require('axios');
const db = require('../db/init');
require('dotenv').config();

const GOLD_API_KEY = process.env.GOLD_API_KEY;

async function fetchGoldPrice() {
  try {
    const response = await axios.get('https://www.goldapi.io/api/XAU/USD', {
      headers: {
        'x-access-token': GOLD_API_KEY,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; GoldPredictor/1.0)'
      },
      timeout: 15000
    });

    const data = response.data;
    const price = data.price;
    if (!price) throw new Error('No price in response: ' + JSON.stringify(data));

    db.prepare(`INSERT INTO gold_prices (price, currency) VALUES (?, 'USD')`).run(price);
    console.log(`[GoldAPI] Price: $${price}`);
    return price;
  } catch (err) {
    console.error('[GoldAPI] Error:', err.response?.status, err.message);
    // 返回最近一次缓存价格
    const last = db.prepare('SELECT price FROM gold_prices ORDER BY fetched_at DESC LIMIT 1').get();
    return last ? last.price : null;
  }
}

function getLatestPrice() {
  return db.prepare('SELECT * FROM gold_prices ORDER BY fetched_at DESC LIMIT 1').get();
}

function getPriceHistory(days = 7) {
  // 每天最多取4个点，避免数据过多
  return db.prepare(`
    SELECT price, fetched_at
    FROM gold_prices
    WHERE fetched_at >= datetime('now', '-${days} days')
    ORDER BY fetched_at ASC
  `).all();
}

module.exports = { fetchGoldPrice, getLatestPrice, getPriceHistory };
