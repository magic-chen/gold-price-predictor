/**
 * 情绪分析服务：判断新闻对金价的影响方向（利好/利空/中性）
 * 同时提供简单的中文摘要生成（基于关键词规则）
 */

// 利好金价的关键词（看涨信号）
const BULLISH_SIGNALS = [
  { kw: 'war',           reason: '地缘冲突升温推动避险需求' },
  { kw: 'conflict',      reason: '地缘冲突升温推动避险需求' },
  { kw: 'invasion',      reason: '军事冲突爆发推高避险情绪' },
  { kw: 'attack',        reason: '军事打击事件推高避险情绪' },
  { kw: 'sanctions',     reason: '制裁措施加剧地缘风险溢价' },
  { kw: 'crisis',        reason: '危机事件触发市场避险情绪' },
  { kw: 'recession',     reason: '经济衰退预期推升黄金配置需求' },
  { kw: 'inflation',     reason: '通胀压力上升利于黄金保值属性' },
  { kw: 'stagflation',   reason: '滞胀预期下黄金是最优避险资产' },
  { kw: 'rate cut',      reason: '降息预期降低持有黄金机会成本' },
  { kw: 'dovish',        reason: '鸽派政策立场利好黄金上涨' },
  { kw: 'default',       reason: '债务违约风险推动资金流向黄金' },
  { kw: 'debt ceiling',  reason: '债务上限危机增加黄金避险需求' },
  { kw: 'bank failure',  reason: '银行危机触发系统性风险预期' },
  { kw: 'uncertainty',   reason: '市场不确定性上升利好避险资产' },
  { kw: 'oil spike',     reason: '油价飙升加剧通胀预期利好黄金' },
  { kw: 'oil shock',     reason: '油价冲击带动商品整体上涨' },
  { kw: 'geopolit',      reason: '地缘政治紧张局势利好黄金' },
  { kw: 'middle east',   reason: '中东局势动荡提升避险需求' },
  { kw: 'safe haven',    reason: '市场主动寻求避险配置黄金' },
  { kw: 'risk off',      reason: '市场风险偏好下降利好黄金' },
  { kw: 'central bank',  reason: '央行购金行为支撑黄金需求' },
  { kw: 'iran',          reason: '伊朗局势紧张增加地缘风险溢价' },
];

// 利空金价的关键词（看跌信号）
const BEARISH_SIGNALS = [
  { kw: 'rate hike',     reason: '加息预期提升持有黄金机会成本' },
  { kw: 'hawkish',       reason: '鹰派货币政策立场打压黄金' },
  { kw: 'strong dollar', reason: '美元走强压制黄金计价' },
  { kw: 'dollar surge',  reason: '美元走强压制黄金计价' },
  { kw: 'ceasefire',     reason: '停火协议缓解地缘风险溢价' },
  { kw: 'peace',         reason: '地缘局势缓和减少避险需求' },
  { kw: 'resolution',    reason: '紧张局势化解降低避险需求' },
  { kw: 'deal',          reason: '协议达成缓解市场担忧情绪' },
  { kw: 'recovery',      reason: '经济复苏预期推动资金流出黄金' },
  { kw: 'growth',        reason: '经济增长向好降低避险配置需求' },
  { kw: 'surplus',       reason: '财政状况改善降低尾部风险' },
  { kw: 'risk on',       reason: '市场风险偏好上升资金流出黄金' },
  { kw: 'optimism',      reason: '市场乐观情绪降低避险需求' },
  { kw: 'sanctions relief', reason: '制裁松绑缓解地缘风险溢价' },
];

// 事件标题的中文翻译映射（常见关键词快速翻译）
const TRANSLATE_MAP = {
  'federal reserve': '美联储',
  'interest rate': '利率',
  'rate hike': '加息',
  'rate cut': '降息',
  'inflation': '通货膨胀',
  'recession': '经济衰退',
  'stagflation': '滞胀',
  'gdp': 'GDP',
  'treasury': '美国国债',
  'sanctions': '制裁',
  'ceasefire': '停火',
  'oil': '油价',
  'gold': '黄金',
  'dollar': '美元',
  'central bank': '央行',
  'war': '战争',
  'conflict': '冲突',
  'iran': '伊朗',
  'russia': '俄罗斯',
  'china': '中国',
  'powell': '鲍威尔',
  'trump': '特朗普',
  'middle east': '中东',
  'tariff': '关税',
  'geopolitical': '地缘政治',
  'bank': '银行',
  'unemployment': '失业率',
  'jobs': '就业',
  'cpi': 'CPI',
};

function analyzeSentiment(title, summary, keywords) {
  const text = `${title} ${summary} ${keywords}`.toLowerCase();

  let bullishScore = 0, bearishScore = 0;
  const bullishReasons = [], bearishReasons = [];

  for (const s of BULLISH_SIGNALS) {
    if (text.includes(s.kw)) {
      bullishScore++;
      if (!bullishReasons.includes(s.reason)) bullishReasons.push(s.reason);
    }
  }
  for (const s of BEARISH_SIGNALS) {
    if (text.includes(s.kw)) {
      bearishScore++;
      if (!bearishReasons.includes(s.reason)) bearishReasons.push(s.reason);
    }
  }

  let sentiment, reason;
  if (bullishScore > bearishScore) {
    sentiment = 'bullish';
    reason = bullishReasons.slice(0, 2).join('；');
  } else if (bearishScore > bullishScore) {
    sentiment = 'bearish';
    reason = bearishReasons.slice(0, 2).join('；');
  } else if (bullishScore === 0 && bearishScore === 0) {
    sentiment = 'neutral';
    reason = '暂无明确影响信号';
  } else {
    sentiment = 'neutral';
    reason = `多空信号混合：利好（${bullishReasons[0] || ''}）vs 利空（${bearishReasons[0] || ''}）`;
  }

  return { sentiment, reason };
}

function quickTranslate(text) {
  // 用关键词映射做粗略翻译提示（不替换全文，只是为了让用户大致看懂）
  // 实际项目可接入 DeepL/百度翻译 API
  let result = text;
  for (const [en, zh] of Object.entries(TRANSLATE_MAP)) {
    const regex = new RegExp(en, 'gi');
    result = result.replace(regex, `${zh}`);
  }
  return result;
}

module.exports = { analyzeSentiment, quickTranslate, BULLISH_SIGNALS, BEARISH_SIGNALS };
