# MySyntroMed - Hostinger + Production Backend Deployment Guide

## 🏠 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    mysyntromed.com                         │
│                   (Hostinger Hosting)                      │
│                   Frontend: React/Vite                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ API Calls
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              api.mysyntromed.com                           │
│         Backend: Node.js + Express (Always-On)              │
│              Hostinger VPS / Cloud Server                   │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       ┌──────────┐   ┌──────────┐   ┌──────────┐
       │ Firebase │   │  Email   │   │  SMTP    │
       │ Firestore│   │  Server  │   │  Service │
       └──────────┘   └──────────┘   └──────────┘
```

---

## 🚀 OPTION 1: Hostinger VPS (Recommended for Always-On)

Hostinger VPS keeps your backend running 24/7.

### Step 1.1: Create VPS on Hostinger

1. Log into [Hostinger](https://hpanel.hostinger.com)
2. Go to **VPS** → **Create VPS**
3. Select plan (Starter $4.99/month is enough)
4. Choose **Ubuntu 22.04** or **Debian**
5. Create SSH key or password
6. Wait for deployment (~5 minutes)

### Step 1.2: Configure VPS

SSH into your server:
```bash
ssh root@your-vps-ip
```

Update system and install dependencies:
```bash
apt update && apt upgrade -y
apt install -y nodejs npm nginx certbot python3-certbot-nginx
node -v  # Should be v18+ for production
```

### Step 1.3: Deploy Backend

Clone your repository:
```bash
cd /var/www
git clone https://github.com/YOUR_USERNAME/mysyntromed.git
cd mysyntromed/backend
npm install
npm run build
```

Create environment file:
```bash
nano .env
```

Add these variables:
```env
PORT=3001
NODE_ENV=production
FRONTEND_ORIGIN=https://mysyntromed.com
FIREBASE_PROJECT_ID=mysyntromed-81242
SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"mysyntromed-81242",...}
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

Create systemd service:
```bash
nano /etc/systemd/system/mysyntromed-backend.service
```

Paste this:
```ini
[Unit]
Description=MySyntroMed Backend API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/mysyntromed/backend
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
```

Enable and start service:
```bash
systemctl daemon-reload
systemctl enable mysyntromed-backend
systemctl start mysyntromed-backend
systemctl status mysyntromed-backend
```

### Step 1.4: Configure Nginx Reverse Proxy

```bash
nano /etc/nginx/sites-available/api.mysyntromed.com
```

Paste this:
```nginx
server {
    listen 80;
    server_name api.mysyntromed.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:
```bash
ln -s /etc/nginx/sites-available/api.mysyntromed.com /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### Step 1.5: SSL Certificate (Free)

```bash
certbot --nginx -d api.mysyntromed.com
```

### Step 1.6: DNS Configuration

In Hostinger DNS or your domain registrar:
```
Type: A
Name: api
Value: YOUR_VPS_IP
TTL: 3600
```

---

## 🆓 OPTION 2: Railway + Cloudflare Tunnel (Free Always-On)

If you don't want VPS, use Cloudflare Tunnel to keep Railway awake.

### Step 2.1: Deploy to Railway
1. Go to [railway.app](https://railway.app)
2. Deploy from GitHub
3. Set environment variables (same as VPS)
4. Get your Railway URL

### Step 2.2: Cloudflare Tunnel (Keeps Railway Awake)
```bash
# On any always-on machine (raspberry pi, old computer, etc)
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x cloudflared-linux-amd64
mv cloudflared-linux-amd64 /usr/local/bin/cloudflared

cloudflared tunnel create mysyntromed
cloudflared tunnel route dns mysyntromed api.mysyntromed.com
cloudflared tunnel run --token YOUR_TUNNEL_TOKEN
```

---

## 🌐 Frontend Deployment to Hostinger

### Step 1: Build Frontend

On your local machine:
```bash
cd frontend
npm install
npm run build
```

### Step 2: Upload to Hostinger

1. Log into Hostinger File Manager
2. Navigate to `public_html`
3. Upload contents of `frontend/dist`
4. Ensure `index.html` is in `public_html`

### Step 3: Update API URL

In Hostinger File Manager, edit `index.html` or create a config file to point to your backend:
```javascript
window.ENV = {
  VITE_API_BASE_URL: 'https://api.mysyntromed.com'
};
```

---

## 🔒 Firebase Configuration

### Step 1: Add Authorized Domains

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select project → **Authentication** → **Settings**
3. Under **Authorized domains**, add:
   - `mysyntromed.com`
   - `www.mysyntromed.com`
   - `api.mysyntromed.com`

### Step 2: Deploy Firestore Rules

In your project root:
```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

### Step 3: Enable App Check (Recommended)

1. Firebase Console → **App Check**
2. Register your app with reCAPTCHA Enterprise
3. Add site key to frontend `.env`

---

## 📧 Email Configuration

### Gmail SMTP (Development)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
```

### SendGrid (Production - Recommended)
```env
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=SG.xxxxxx
```

### Mailgun (Production)
```env
EMAIL_SERVICE=mailgun
MAILGUN_DOMAIN=mg.mysyntromed.com
MAILGUN_API_KEY=key-xxxxx
```

---

## ✅ Verification Checklist

After deployment, test these URLs:

- [ ] `https://api.mysyntromed.com/health` → `{"ok":true}`
- [ ] `https://mysyntromed.com` → Frontend loads
- [ ] User login works
- [ ] Admin can create users
- [ ] Messages send between users
- [ ] Contact form sends email

---

## 🐛 Troubleshooting

### Backend not responding?
```bash
systemctl status mysyntromed-backend
journalctl -u mysyntromed-backend -f
```

### CORS errors?
- Verify `FRONTEND_ORIGIN` matches exactly: `https://mysyntromed.com`
- No trailing slash!

### SSL not working?
```bash
certbot --nginx -d api.mysyntromed.com --force-renewal
```

### Firebase auth not working?
- Add `api.mysyntromed.com` to Firebase Authorized Domains

---

## 💰 Cost Summary

| Component | Provider | Cost |
|-----------|----------|------|
| Frontend | Hostinger (included) | $0 |
| Backend VPS | Hostinger VPS | $4.99/mo |
| Domain | Hostinger | $10/yr |
| SSL | Let's Encrypt | Free |
| Database | Firebase Spark | Free |
| **Total** | | **~$5/month** |
