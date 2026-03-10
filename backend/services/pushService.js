/**
 * 飞书推送服务：当有重要新事件时主动推送消息
 */
const axios = require('axios');
require('dotenv').config();

// 飞书 webhook 或者直接用 bot API 发消息给用户
// 这里用环境变量配置飞书用户的 open_id
const FEISHU_USER_ID = process.env.FEISHU_USER_ID || '';
const FEISHU_APP_ID = process.env.FEISHU_APP_ID || '';
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || '';
const FEISHU_WEBHOOK = process.env.FEISHU_WEBHOOK || '';

let _token = null;
let _tokenExpire = 0;

async function getTenantToken() {
  if (_token && Date.now() < _tokenExpire) return _token;
  try {
    const res = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      app_id: FEISHU_APP_ID,
      app_secret: FEISHU_APP_SECRET
    }, { timeout: 8000 });
    _token = res.data.tenant_access_token;
    _tokenExpire = Date.now() + (res.data.expire - 60) * 1000;
    return _token;
  } catch (e) {
    console.error('[Feishu] Token error:', e.message);
    return null;
  }
}

async function sendFeishuMessage(text) {
  // 方式1：Webhook（最简单）
  if (FEISHU_WEBHOOK) {
    try {
      await axios.post(FEISHU_WEBHOOK, {
        msg_type: 'text',
        content: { text }
      }, { timeout: 8000 });
      console.log('[Feishu] Webhook sent OK');
      return true;
    } catch (e) {
      console.error('[Feishu] Webhook error:', e.message);
    }
  }

  // 方式2：Bot API 发送给用户
  if (FEISHU_APP_ID && FEISHU_USER_ID) {
    try {
      const token = await getTenantToken();
      if (!token) return false;
      await axios.post('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id', {
        receive_id: FEISHU_USER_ID,
        msg_type: 'text',
        content: JSON.stringify({ text })
      }, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 8000
      });
      console.log('[Feishu] Bot message sent OK');
      return true;
    } catch (e) {
      console.error('[Feishu] Bot API error:', e.message);
    }
  }

  console.warn('[Feishu] No push config, skipping notification');
  return false;
}

/**
 * 构建推送内容：新事件摘要
 */
function buildPushMessage(newEvents, currentPrice) {
  const bullish = newEvents.filter(e => e.sentiment === 'bullish');
  const bearish = newEvents.filter(e => e.sentiment === 'bearish');

  let overall = '信号混合';
  if (bullish.length > bearish.length) overall = '📈 整体利好';
  else if (bearish.length > bullish.length) overall = '📉 整体利空';

  const priceStr = currentPrice ? `$${Number(currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--';

  let msg = `🥇 金价预测 · 新事件播报\n`;
  msg += `当前金价：${priceStr} | ${overall}\n`;
  msg += `─────────────────\n`;

  const top = newEvents.slice(0, 5);
  top.forEach((evt, i) => {
    const icon = evt.sentiment === 'bullish' ? '↑利好' : evt.sentiment === 'bearish' ? '↓利空' : '—中性';
    msg += `${i + 1}. [${icon}] ${evt.title.slice(0, 60)}${evt.title.length > 60 ? '...' : ''}\n`;
    if (evt.sentiment_reason) msg += `   └ ${evt.sentiment_reason}\n`;
  });

  msg += `─────────────────\n`;
  msg += `📊 查看完整预测：https://www.awsprompts.com/goldpredict/`;

  return msg;
}

module.exports = { sendFeishuMessage, buildPushMessage };
