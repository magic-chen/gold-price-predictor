#!/bin/bash
# 一键部署脚本

SERVER="root@139.196.232.194"
SSH_KEY="$HOME/.ssh1/id_rsa"
APP_DIR="/var/www/gold-predictor"

echo "🚀 开始部署 Gold Predictor..."

# 1. 本地构建前端
echo "📦 构建前端..."
cd "$(dirname "$0")/frontend"
npm install
npm run build

cd "$(dirname "$0")"

# 2. 同步代码到服务器
echo "📤 上传代码..."
ssh -i "$SSH_KEY" "$SERVER" "mkdir -p $APP_DIR"

rsync -avz --progress \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='backend/data' \
  --exclude='frontend/node_modules' \
  -e "ssh -i $SSH_KEY" \
  ./ "$SERVER:$APP_DIR/"

# 3. 服务器上安装依赖 + 启动
echo "⚙️ 服务器配置..."
ssh -i "$SSH_KEY" "$SERVER" << 'EOF'
  APP_DIR="/var/www/gold-predictor"

  # 安装后端依赖
  cd "$APP_DIR/backend"
  npm install --production

  # 检查 .env 是否存在
  if [ ! -f .env ]; then
    cp .env.example .env
    echo "⚠️  请编辑 $APP_DIR/backend/.env 填写 API Key"
  fi

  # 安装 PM2（如果没有）
  which pm2 || npm install -g pm2

  # 启动/重启应用
  pm2 stop gold-predictor 2>/dev/null || true
  pm2 start index.js --name gold-predictor --cwd "$APP_DIR/backend"
  pm2 save
  pm2 startup 2>/dev/null || true

  echo "✅ 应用已启动"
  pm2 status
EOF

# 4. 配置 Nginx
echo "🔧 配置 Nginx..."
ssh -i "$SSH_KEY" "$SERVER" << 'NGINX'
cat > /etc/nginx/conf.d/gold-predictor.conf << 'CONF'
server {
    listen 80;
    server_name _;

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        root /var/www/gold-predictor/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
CONF

nginx -t && systemctl reload nginx
echo "✅ Nginx 配置完成"
NGINX

echo ""
echo "🎉 部署完成！"
echo "🌐 访问: http://139.196.232.194"
