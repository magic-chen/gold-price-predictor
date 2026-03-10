# Gold Price Predictor

🥇 国际金价预测仪表盘 — 基于国际大事件对金价走势进行分析预测，并累计追踪预测准确率。

## 功能特点

- **实时金价**：通过 GoldAPI.io 获取实时 XAU/USD 价格
- **事件追踪**：自动从多个国际财经新闻源（Reuters、BBC、CNBC、MarketWatch、Kitco）抓取影响金价的大事件
- **AI 预测**：基于关键词规则分析事件情绪，生成涨/跌/震荡预测
- **准确率追踪**：24小时后自动验证预测，累计统计准确率
- **优雅界面**：深色金融风格，实时走势图，响应式布局

## 技术栈

- **前端**：React 18 + TailwindCSS + Recharts
- **后端**：Node.js + Express + SQLite
- **部署**：Nginx 反向代理

## 快速启动

```bash
# 后端
cd backend
npm install
cp .env.example .env  # 填入 GOLD_API_KEY
npm start

# 前端（开发）
cd frontend
npm install
npm run dev

# 前端（生产构建）
cd frontend
npm run build
```

## 部署

服务器要求：Node.js 20+、Nginx

```bash
./deploy.sh  # 一键部署到服务器
```

## 数据来源

- 金价数据：[GoldAPI.io](https://www.goldapi.io)
- 新闻数据：Reuters, BBC Business, CNBC, MarketWatch, Kitco（公开 RSS）

---

> ⚠️ 数据仅供参考，不构成投资建议
