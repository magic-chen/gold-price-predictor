/**
 * 新闻爬取服务：从多个财经新闻源抓取影响金价的国际大事件
 */
const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../db/init');
const { analyzeSentiment, quickTranslate } = require('./sentimentService');

// 金价敏感关键词
const GOLD_KEYWORDS = [
  'gold', 'inflation', 'fed', 'federal reserve', 'interest rate', 'dollar', 'USD',
  'war', 'conflict', 'geopolitical', 'ukraine', 'russia', 'china', 'iran',
  'recession', 'crisis', 'debt', 'treasury', 'safe haven', 'risk off',
  'central bank', 'rate hike', 'rate cut', 'powell', 'CPI', 'GDP',
  'sanctions', 'tariff', 'trade war', 'oil', 'middle east', 'stagflation',
  'xau', 'precious metal', 'bullion', 'silver', 'commodity',
  '黄金', '美联储', '加息', '降息', '通胀', '地缘政治', '战争', '危机'
];

// 可用新闻源（经过服务器连通性测试）
const NEWS_SOURCES = [
  {
    name: 'WSJ Markets',
    url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',
    type: 'rss'
  },
  {
    name: 'ForexLive',
    url: 'https://www.forexlive.com/feed/news',
    type: 'rss'
  },
  {
    name: 'Investing.com Gold',
    url: 'https://www.investing.com/rss/news_25.rss',
    type: 'rss'
  },
  {
    name: 'CNBC Economy',
    url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html',
    type: 'rss',
    fallback: true
  },
  {
    name: 'MarketWatch',
    url: 'https://feeds.marketwatch.com/marketwatch/topstories/',
    type: 'rss',
    fallback: true
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
      timeout: 12000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    const $ = cheerio.load(response.data, { xmlMode: true });
    const items = [];

    $('item').each((i, el) => {
      if (i >= 25) return false;
      const title = $(el).find('title').first().text().trim();
      const description = $(el).find('description').first().text().replace(/<[^>]+>/g, '').trim();
      const link = $(el).find('link').first().text().trim() || $(el).find('link').first().attr('href') || '';
      const pubDate = $(el).find('pubDate').first().text().trim() || new Date().toISOString();

      if (!title) return;

      const { score, matchedKeywords } = scoreImpact(title, description);
      if (score > 0) {
        items.push({
          title,
          summary: description.substring(0, 600),
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
    console.error(`[News] Failed ${source.name}: ${err.message}`);
    return [];
  }
}

async function fetchAllNews() {
  const allItems = [];

  for (const source of NEWS_SOURCES) {
    const items = await fetchRSSFeed(source);
    allItems.push(...items);
    await new Promise(r => setTimeout(r, 800));
  }

  allItems.sort((a, b) => b.impact_score - a.impact_score);
  const topItems = allItems.slice(0, 40);

  try {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_events_url ON events(url)`);
  } catch (e) {}

  const insert = db.prepare(`
    INSERT OR IGNORE INTO events (title, summary, source, url, published_at, impact_keywords, title_zh, sentiment, sentiment_reason)
    VALUES (@title, @summary, @source, @url, @published_at, @impact_keywords, @title_zh, @sentiment, @sentiment_reason)
  `);

  let saved = 0;
  for (const item of topItems) {
    try {
      const { sentiment, reason } = analyzeSentiment(item.title, item.summary || '', item.impact_keywords || '');
      const title_zh = quickTranslate(item.title);
      insert.run({ ...item, title_zh, sentiment, sentiment_reason: reason });
      saved++;
    } catch (e) {}
  }

  console.log(`[News] Saved ${saved} new events (total fetched: ${allItems.length})`);
  return topItems;
}

function getRecentEvents(days = 7) {
  return db.prepare(`
    SELECT * FROM events
    WHERE published_at >= datetime('now', '-${days} days')
    ORDER BY published_at DESC
    LIMIT 60
  `).all();
}

module.exports = { fetchAllNews, getRecentEvents, GOLD_KEYWORDS };
