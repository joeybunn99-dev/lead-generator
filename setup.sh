#!/bin/bash
# ─────────────────────────────────────────────────────────────────
#  Lead Generator — VPS Setup Script
#  Run once on a fresh Ubuntu 22.04 / 24.04 server:
#
#    chmod +x setup.sh
#    sudo ./setup.sh
# ─────────────────────────────────────────────────────────────────
set -e

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="lead-generator"

echo ""
echo "╔═══════════════════════════════════════╗"
echo "║   Lead Generator — VPS Setup          ║"
echo "╚═══════════════════════════════════════╝"
echo "  App folder: $APP_DIR"
echo ""

# ── Ask for domain or IP ───────────────────────────────────────
read -p "Enter your domain or server IP (e.g. leads.yourdomain.com or 123.45.67.89): " DOMAIN
if [[ -z "$DOMAIN" ]]; then
    echo "ERROR: domain/IP is required." && exit 1
fi

# ── 1. System update ──────────────────────────────────────────
echo ""
echo "[ 1/7 ] Updating system packages..."
apt-get update -q
apt-get upgrade -y -q

# ── 2. Node.js 22 ────────────────────────────────────────────
echo "[ 2/7 ] Installing Node.js 22..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# ── 3. PM2 ───────────────────────────────────────────────────
echo "[ 3/7 ] Installing PM2..."
npm install -g pm2

# ── 4. nginx ─────────────────────────────────────────────────
echo "[ 4/7 ] Installing nginx..."
apt-get install -y nginx

# ── 5. Certbot (free SSL) ────────────────────────────────────
echo "[ 5/7 ] Installing Certbot..."
apt-get install -y certbot python3-certbot-nginx

# ── 6. App dependencies ──────────────────────────────────────
echo "[ 6/7 ] Installing app dependencies..."
cd "$APP_DIR"
npm install --omit=dev

# ── 7. nginx config ──────────────────────────────────────────
echo "[ 7/7 ] Configuring nginx..."
NGINX_CONF="/etc/nginx/sites-available/$APP_NAME"
cp "$APP_DIR/nginx-leadgen.conf" "$NGINX_CONF"
sed -i "s/YOUR_DOMAIN_OR_IP/$DOMAIN/g" "$NGINX_CONF"
ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/$APP_NAME"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl reload nginx

# ── Start app with PM2 ───────────────────────────────────────
echo ""
echo "Starting app with PM2..."
cd "$APP_DIR"
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash

# ── Optional SSL ─────────────────────────────────────────────
echo ""
IS_IP=false
[[ "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] && IS_IP=true

if $IS_IP; then
    echo "⚠  SSL skipped — SSL requires a domain name, not an IP address."
    echo "   Point a domain at this server, then run:"
    echo "   certbot --nginx -d $DOMAIN"
else
    read -p "Set up free SSL certificate for $DOMAIN? (y/n): " SSL
    if [[ "$SSL" == "y" || "$SSL" == "Y" ]]; then
        read -p "Enter your email for SSL renewal notices: " SSL_EMAIL
        certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$SSL_EMAIL"
    fi
fi

# ── Done ─────────────────────────────────────────────────────
echo ""
echo "╔═══════════════════════════════════════╗"
echo "║   ✅  Setup complete!                  ║"
echo "╚═══════════════════════════════════════╝"
echo ""
echo "  Your app is live at:  http://$DOMAIN"
echo ""
echo "  Useful commands:"
echo "    pm2 status                       — check if app is running"
echo "    pm2 logs lead-generator          — live logs"
echo "    pm2 restart lead-generator       — restart after config changes"
echo "    pm2 stop lead-generator          — stop"
echo ""
