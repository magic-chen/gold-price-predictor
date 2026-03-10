/**
 * 推送服务：把消息写入队列文件，由外部消费（如 OpenClaw）
 */
const fs = require('fs');
const path = require('path');

const QUEUE_FILE = path.join(__dirname, '../data/push_queue.json');

function readQueue() {
  try {
    if (!fs.existsSync(QUEUE_FILE)) return [];
    return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'));
  } catch { return []; }
}

function writeQueue(queue) {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

async function sendFeishuMessage(text) {
  try {
    const queue = readQueue();
    queue.push({
      id: Date.now(),
      text,
      ts: new Date().toISOString(),
      sent: false
    });
    writeQueue(queue);
    console.log('[Push] Message queued:', text.slice(0, 60));
    return true;
  } catch (e) {
    console.error('[Push] Queue error:', e.message);
    return false;
  }
}

function buildPushMessage(newEvents, currentPrice) {
  const bullish = newEvents.filter(e => e.sentiment === 'bullish').length;
  const bearish = newEvents.filter(e => e.sentiment === 'bearish').length;

  let overall = '信号混合';
  if (bullish > bearish) overall = '📈 整体利好';
  else if (bearish > bullish) overall = '📉 整体利空';

  const priceStr = currentPrice
    ? `$${Number(currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '--';

  let msg = `🥇 金价预测 · 新事件播报\n`;
  msg += `当前金价：${priceStr} | ${overall}\n`;
  msg += `─────────────────\n`;

  newEvents.slice(0, 5).forEach((evt, i) => {
    const icon = evt.sentiment === 'bullish' ? '↑利好' : evt.sentiment === 'bearish' ? '↓利空' : '—中性';
    msg += `${i + 1}. [${icon}] ${evt.title.slice(0, 60)}${evt.title.length > 60 ? '...' : ''}\n`;
    if (evt.sentiment_reason) msg += `   └ ${evt.sentiment_reason}\n`;
  });

  msg += `─────────────────\n`;
  msg += `查看完整预测：https://www.awsprompts.com/goldpredict/`;

  return msg;
}

// 供 API 路由调用：读取未发送的消息并标记为已发送
function consumeQueue() {
  const queue = readQueue();
  const pending = queue.filter(m => !m.sent);
  if (pending.length === 0) return [];
  const updated = queue.map(m => ({ ...m, sent: true }));
  writeQueue(updated);
  return pending;
}

module.exports = { sendFeishuMessage, buildPushMessage, consumeQueue };
