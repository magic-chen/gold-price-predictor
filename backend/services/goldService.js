/**
 * 金价服务：主要用 GoldAPI.io，备用 api.gold-api.com（无需 Key）
 */
const axios = require('axios');
const db = require('../db/init');
require('dotenv').config();

const GOLD_API_KEY = process.env.GOLD_API_KEY;

// 主源：GoldAPI.io
async function fetchFromGoldAPI() {
  const response = await axios.get('https://www.goldapi.io/api/XAU/USD', {
    headers: {
      'x-access-token': GOLD_API_KEY,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; GoldPredictor/1.0)'
    },
    timeout: 12000
  });
  const price = response.data.price;
  if (!price) throw new Error('No price field');
  return price;
}

// 备用源：api.gold-api.com（免费，无需 Key）
async function fetchFromFallback() {
  const response = await axios.get('https://api.gold-api.com/price/XAU', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GoldPredictor/1.0)' },
    timeout: 12000
  });
  const price = response.data.price;
  if (!price) throw new Error('No price field');
  return Math.round(price * 100) / 100;
}

async function fetchGoldPrice() {
  let price = null;

  // 先试主源
  try {
    price = await fetchFromGoldAPI();
    console.log(`[GoldAPI] Primary OK: $${price}`);
  } catch (err) {
    console.warn(`[GoldAPI] Primary failed (${err.response?.status || err.message}), trying fallback...`);
    // 再试备用
    try {
      price = await fetchFromFallback();
      console.log(`[GoldAPI] Fallback OK: $${price}`);
    } catch (err2) {
      console.error(`[GoldAPI] Fallback also failed: ${err2.message}`);
    }
  }

  if (price) {
    db.prepare(`INSERT INTO gold_prices (price, currency) VALUES (?, 'USD')`).run(price);
    return price;
  }

  // 返回缓存
  const last = db.prepare('SELECT price FROM gold_prices ORDER BY fetched_at DESC LIMIT 1').get();
  return last ? last.price : null;
}

function getLatestPrice() {
  return db.prepare('SELECT * FROM gold_prices ORDER BY fetched_at DESC LIMIT 1').get();
}

function getPriceHistory(days = 7) {
  return db.prepare(`
    SELECT price, fetched_at
    FROM gold_prices
    WHERE fetched_at >= datetime('now', '-${days} days')
    ORDER BY fetched_at ASC
  `).all();
}

module.exports = { fetchGoldPrice, getLatestPrice, getPriceHistory };
