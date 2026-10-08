#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# Oracle Cloud Always Free - DevBrawl Deployment Script
# Run on a fresh Ubuntu 22.04/24.04 ARM instance (VM.Standard.A1.Flex)
# ──────────────────────────────────────────────────────────────────────────────

set -e

echo "🚀 Starting DevBrawl deployment on Oracle Cloud Always Free..."

# ─── 1. System Updates & Essentials ───────────────────────────────────────────
echo "📦 Updating system packages..."
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y \
  curl wget git unzip htop jq \
  build-essential python3 python3-pip \
  nginx certbot python3-certbot-nginx \
  ufw fail2ban

# ─── 2. Install Node.js 20 (LTS) ──────────────────────────────────────────────
echo "📦 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version && npm --version

# ─── 3. Install Docker & Docker Compose ───────────────────────────────────────
echo "🐳 Installing Docker..."
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
sudo systemctl enable docker

# Docker Compose v2 (plugin)
sudo apt-get install -y docker-compose-plugin
docker compose version

# ─── 4. Install MongoDB 7.0 (ARM64) ───────────────────────────────────────────
echo "🍃 Installing MongoDB..."
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl enable mongod
sudo systemctl start mongod

# ─── 5. Install Piston (Code Execution Engine) ────────────────────────────────
echo "⚙️ Installing Piston..."
cd /opt
sudo git clone https://github.com/engineer-man/piston.git
cd piston
sudo docker compose pull
sudo docker compose up -d

# Wait for Piston to be ready
echo "⏳ Waiting for Piston to start..."
sleep 30
curl -f http://localhost:2000/health || echo "Piston health check failed"

# ─── 6. Setup Application Directory ───────────────────────────────────────────
echo "📁 Setting up application..."
sudo mkdir -p /var/www/devbrawl
sudo chown -R $USER:$USER /var/www/devbrawl

# ─── 7. Configure Nginx Reverse Proxy ─────────────────────────────────────────
echo "🌐 Configuring Nginx..."
sudo tee /etc/nginx/sites-available/devbrawl > /dev/null <<'NGINX_CONF'
# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=ws:10m rate=10r/s;

upstream backend {
    server 127.0.0.1:8000;
    keepalive 32;
}

upstream piston {
    server 127.0.0.1:2000;
    keepalive 16;
}

server {
    listen 80;
    server_name _;  # Replace with your domain

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml application/json;

    # API routes
    location /api/ {
        limit_req zone=api burst=50 nodelay;
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }

    # WebSocket for Socket.io
    location /socket.io/ {
        limit_req zone=ws burst=20 nodelay;
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # Piston API (internal only - not exposed publicly)
    location /piston/ {
        internal;
        proxy_pass http://piston/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Health check (for load balancer)
    location /health {
        access_log off;
        proxy_pass http://backend/api/v1/compiler/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # Frontend (if serving from same VM)
    location / {
        root /var/www/devbrawl/frontend/dist;
        try_files $uri $uri/ /index.html;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINX_CONF

sudo ln -sf /etc/nginx/sites-available/devbrawl /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# ─── 8. Configure Firewall ────────────────────────────────────────────────────
echo "🔥 Configuring firewall..."
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw --force enable

# ─── 9. Setup Fail2Ban ────────────────────────────────────────────────────────
echo "🛡️ Configuring Fail2Ban..."
sudo tee /etc/fail2ban/jail.local > /dev/null <<'FAIL2BAN_CONF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
logpath = %(sshd_log)s

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
logpath = /var/log/nginx/error.log
maxretry = 10
FAIL2BAN_CONF

sudo systemctl enable fail2ban
sudo systemctl restart fail2ban

# ─── 10. Create Systemd Service for Backend ───────────────────────────────────
echo "⚙️ Creating systemd service..."
sudo tee /etc/systemd/system/devbrawl-backend.service > /dev/null <<'SERVICE_CONF'
[Unit]
Description=DevBrawl Backend
After=network.target mongod.service
Requires=mongod.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/www/devbrawl/backend
Environment=NODE_ENV=production
Environment=PORT=8000
Environment=PISTON_API_URL=http://localhost:2000
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=devbrawl-backend

# Resource limits (Oracle Free Tier: 4 CPU, 24GB RAM)
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
SERVICE_CONF

sudo systemctl daemon-reload
sudo systemctl enable devbrawl-backend

# ─── 11. Setup Log Rotation ───────────────────────────────────────────────────
echo "📝 Configuring log rotation..."
sudo tee /etc/logrotate.d/devbrawl > /dev/null <<'LOGROTATE_CONF'
/var/www/devbrawl/backend/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 ubuntu ubuntu
    sharedscripts
    postrotate
        systemctl reload devbrawl-backend > /dev/null 2>&1 || true
    endscript
}

/var/log/nginx/devbrawl-*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload nginx > /dev/null 2>&1 || true
    endscript
}
LOGROTATE_CONF

# ─── 12. Create Deployment Script ─────────────────────────────────────────────
echo "📜 Creating deploy script..."
cat > /var/www/devbrawl/deploy.sh <<'DEPLOY_SCRIPT'
#!/bin/bash
set -e

cd /var/www/devbrawl

echo "📥 Pulling latest code..."
git pull origin main

echo "📦 Installing backend dependencies..."
cd backend
npm ci --production

echo "🔨 Building frontend..."
cd ../frontend
npm ci
npm run build

echo "🔄 Restarting backend..."
sudo systemctl restart devbrawl-backend

echo "🔄 Reloading nginx..."
sudo systemctl reload nginx

echo "✅ Deployment complete!"
DEPLOY_SCRIPT

chmod +x /var/www/devbrawl/deploy.sh

# ─── 13. Create Monitoring Script ─────────────────────────────────────────────
cat > /var/www/devbrawl/monitor.sh <<'MONITOR_SCRIPT'
#!/bin/bash
echo "=== DevBrawl Health Check ==="
echo "Time: $(date)"
echo ""
echo "--- Backend ---"
systemctl is-active devbrawl-backend
curl -sf http://localhost:8000/api/v1/compiler/health | jq .
echo ""
echo "--- Piston ---"
curl -sf http://localhost:2000/health
echo ""
echo "--- MongoDB ---"
systemctl is-active mongod
echo ""
echo "--- Nginx ---"
systemctl is-active nginx
echo ""
echo "--- Disk Usage ---"
df -h /
echo ""
echo "--- Memory ---"
free -h
echo ""
echo "--- Docker Containers ---"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
MONITOR_SCRIPT

chmod +x /var/www/devbrawl/monitor.sh

echo ""
echo "✅ Oracle Cloud setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Clone your repo: git clone <your-repo> /var/www/devbrawl"
echo "2. Copy .env.example to .env and configure"
echo "3. Run deploy script: /var/www/devbrawl/deploy.sh"
echo "4. Setup SSL: sudo certbot --nginx -d your-domain.com"
echo "5. Monitor: /var/www/devbrawl/monitor.sh"