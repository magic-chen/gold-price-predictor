/**
 * 新闻爬取服务：从多个财经新闻源抓取影响金价的国际大事件
 * 抓取策略：无需API Key，直接抓取公开页面
 */
const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../db/init');

// 金价敏感关键词
const GOLD_KEYWORDS = [
  'gold', 'inflation', 'fed', 'federal reserve', 'interest rate', 'dollar', 'USD',
  'war', 'conflict', 'geopolitical', 'ukraine', 'russia', 'china', 'US china',
  'recession', 'crisis', 'debt', 'treasury', 'safe haven', 'risk off',
  'central bank', 'rate hike', 'rate cut', 'powell', 'CPI', 'GDP',
  'sanctions', 'tariff', 'trade war', 'oil', 'middle east',
  '黄金', '美联储', '加息', '降息', '通胀', '地缘政治', '战争', '危机'
];

// 新闻源配置（全部免费公开）
const NEWS_SOURCES = [
  {
    name: 'Reuters Finance',
    url: 'https://feeds.reuters.com/reuters/businessNews',
    type: 'rss'
  },
  {
    name: 'BBC Business',
    url: 'http://feeds.bbci.co.uk/news/business/rss.xml',
    type: 'rss'
  },
  {
    name: 'FT Markets RSS',
    url: 'https://www.ft.com/markets?format=rss',
    type: 'rss'
  },
  {
    name: 'CNBC Economy',
    url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html',
    type: 'rss'
  },
  {
    name: 'MarketWatch',
    url: 'https://feeds.marketwatch.com/marketwatch/topstories/',
    type: 'rss'
  },
  {
    name: 'Gold Price News',
    url: 'https://www.kitco.com/rss/kitco-news.xml',
    type: 'rss'
  }
];

function scoreImpact(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  let score = 0;
  const matchedKeywords = [];

  GOLD_KEYWORDS.forEach(keyword => {
    if (text.includes(keyword.toLowerCase())) {
      score += 1;
      matchedKeywords.push(keyword);
    }
  });

  return { score, matchedKeywords };
}

async function fetchRSSFeed(source) {
  try {
    const response = await axios.get(source.url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GoldPredictor/1.0)'
      }
    });

    const $ = cheerio.load(response.data, { xmlMode: true });
    const items = [];

    $('item').each((i, el) => {
      if (i >= 20) return false; // 每源最多取20条
      const title = $(el).find('title').first().text().trim();
      const description = $(el).find('description').first().text().replace(/<[^>]+>/g, '').trim();
      const link = $(el).find('link').first().text().trim() || $(el).find('link').first().attr('href') || '';
      const pubDate = $(el).find('pubDate').first().text().trim() || new Date().toISOString();

      if (!title) return;

      const { score, matchedKeywords } = scoreImpact(title, description);
      if (score > 0) {
        items.push({
          title,
          summary: description.substring(0, 500),
          source: source.name,
          url: link,
          published_at: new Date(pubDate).toISOString(),
          impact_score: score,
          impact_keywords: matchedKeywords.join(', ')
        });
      }
    });

    console.log(`[News] ${source.name}: ${items.length} relevant items`);
    return items;
  } catch (err) {
    console.error(`[News] Failed to fetch ${source.name}:`, err.message);
    return [];
  }
}

async function fetchAllNews() {
  const allItems = [];

  for (const source of NEWS_SOURCES) {
    const items = await fetchRSSFeed(source);
    allItems.push(...items);
    await new Promise(r => setTimeout(r, 500)); // 间隔500ms避免过快
  }

  // 按影响分数排序，取最高影响的30条
  allItems.sort((a, b) => b.impact_score - a.impact_score);
  const topItems = allItems.slice(0, 30);

  // 保存到数据库（去重）
  const insert = db.prepare(`
    INSERT OR IGNORE INTO events (title, summary, source, url, published_at, impact_keywords)
    VALUES (@title, @summary, @source, @url, @published_at, @impact_keywords)
  `);

  // 先建 unique index（幂等）
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_events_url ON events(url)`);

  let saved = 0;
  for (const item of topItems) {
    try {
      insert.run(item);
      saved++;
    } catch (e) { /* 重复跳过 */ }
  }

  console.log(`[News] Saved ${saved} new events`);
  return topItems;
}

function getRecentEvents(days = 7) {
  return db.prepare(`
    SELECT * FROM events
    WHERE published_at >= datetime('now', '-${days} days')
    ORDER BY published_at DESC
    LIMIT 50
  `).all();
}

module.exports = { fetchAllNews, getRecentEvents, GOLD_KEYWORDS };
