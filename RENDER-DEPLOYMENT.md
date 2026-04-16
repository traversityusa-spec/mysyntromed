# MySyntroMed - Render Backend Deployment Guide

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    mysyntromed.com                         │
│                   (Hostinger Hosting)                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              api.mysyntromed.com                          │
│         Backend: Node.js on Render                         │
│         (Always-On: $7/month Starter plan)                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                       ┌──────────┐
                       │ Firebase │
                       │ Firestore │
                       └──────────┘
```

---

## Why Render?

| Provider | Free Tier | Always-On | Cost |
|----------|-----------|-----------|------|
| Railway | 500 hrs/mo | ❌ Sleeps 30min | $5+/mo |
| Render | 750 hrs/mo | ❌ Sleeps 15min | $7+/mo |
| **Render (Starter)** | - | ✅ **Always-On** | **$7/month** |
| Fly.io | 3 VMs | ✅ Yes | Free* |

**Render Starter plan ($7/mo) is recommended** - always-on, no cold starts.

---

## Step 1: Prepare Your Repository

Push your code to GitHub (if not already):
```bash
cd /Users/thompsonfadaisi/Downloads/mysyntromed\ 2
git init
git add .
git commit -m "Production ready"
git remote add origin https://github.com/YOUR_USERNAME/mysyntromed.git
git push -u origin main
```

---

## Step 2: Create Render Account

1. Go to [render.com](https://render.com)
2. Click **"Get Started"** → **"Login with GitHub"**
3. Authorize Render to access your repos

---

## Step 3: Deploy Backend to Render

### 3.1: Create New Web Service

1. In Render Dashboard, click **"New +"** → **"Web Service"**
2. Connect your GitHub account
3. Select the **mysyntromed** repository
4. Configure the service:

```
Name: mysyntromed-backend
Region: Choose closest to you
Branch: main
Root Directory: backend
Runtime: Node
Build Command: npm install && npm run build
Start Command: npm start
```

### 3.2: Add Environment Variables

Click **"Environment"** tab and add these:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `FRONTEND_ORIGIN` | `https://mysyntromed.com` |
| `FIREBASE_PROJECT_ID` | `mysyntromed-81242` |
| `SERVICE_ACCOUNT_KEY` | `{...paste entire JSON from service account...}` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `your-email@gmail.com` |
| `SMTP_PASS` | `your-16-char-app-password` |
| `SMTP_FROM` | `MySyntroMed <noreply@mysyntromed.com>` |
| `EMAIL_SERVICE_KEY` | `any-random-32-char-string` |

### 3.3: Get Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select **mysyntromed-81242**
3. Project Settings → Service Accounts
4. Click **"Generate new private key"**
5. Copy the **entire JSON content**
6. Paste as value for `SERVICE_ACCOUNT_KEY` (must be valid JSON, no line breaks)

### 3.4: Select Plan & Deploy

1. Plan: Choose **Starter** ($7/month) for always-on
2. Click **"Create Web Service"**
3. Wait for deployment (~2-3 minutes)

---

## Step 4: Get Your Backend URL

After deployment, you'll see:
```
https://mysyntromed-backend.onrender.com
```

**SAVE THIS URL!** You'll need it for:
1. Frontend API URL
2. DNS configuration

---

## Step 5: Configure Custom Domain

### 5.1: In Render Dashboard

1. Go to your web service → **Settings**
2. Scroll to **Custom Domains**
3. Click **"Add Custom Domain"**
4. Enter: `api.mysyntromed.com`
5. Click **"Add Domain"**

Render will show DNS records to add.

### 5.2: In Hostinger DNS

1. Log into [Hostinger](https://hpanel.hostinger.com)
2. Go to **Domains** → **DNS** for mysyntromed.com
3. Add these records:

```
Type    Name     Value                          TTL
CNAME   api      mysyntromed-backend.onrender.com  3600
```

Or if Render shows A record:
```
Type    Name     Value                          TTL
A       api      [Render's IP address]          3600
```

### 5.3: Wait for SSL

Render automatically provisions SSL certificate (5-10 minutes).

---

## Step 6: Update Frontend

### 6.1: Build Frontend

```bash
cd frontend
npm install
npm run build
```

### 6.2: Update .env

Edit `frontend/.env`:
```env
VITE_API_BASE_URL=https://api.mysyntromed.com
```

### 6.3: Upload to Hostinger

1. Hostinger File Manager → `public_html`
2. Upload all files from `frontend/dist`
3. Delete old files first (optional)

---

## Step 7: Firebase Configuration

### 7.1: Add Authorized Domains

1. [Firebase Console](https://console.firebase.google.com)
2. Select project → **Authentication** → **Settings** → **Authorized domains**
3. Add:
   - `mysyntromed.com`
   - `www.mysyntromed.com`
   - `api.mysyntromed.com`
   - `mysyntromed-backend.onrender.com`

### 7.2: Deploy Firestore Rules

In your project root:
```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

---

## Step 8: Verify Everything Works

### Test Backend Health
```bash
curl https://api.mysyntromed.com/health
```
Should return: `{"ok":true,"service":"backend","timestamp":"..."}`

### Test Frontend
Open: `https://mysyntromed.com`

### Test Features
- [ ] User registration/login
- [ ] Admin can create users
- [ ] Messages send/receive
- [ ] Contact form sends email

---

## 🐛 Troubleshooting

### "Build Failed"
- Check Build Logs in Render dashboard
- Verify `npm run build` works locally first

### "Service Unavailable"
- Check Environment Variables are set correctly
- Verify SERVICE_ACCOUNT_KEY is valid JSON

### CORS Errors
- Ensure `FRONTEND_ORIGIN=https://mysyntromed.com` (exact, no trailing slash)

### Slow Cold Start (if using Free tier)
- Upgrade to Starter plan ($7/mo) for always-on

---

## 📧 Email Setup

### Gmail (Development)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx    # 16-char app password
```

To get Gmail app password:
1. Google Account → Security
2. 2-Step Verification → On
3. App passwords → Create new
4. Copy the 16-char password

### SendGrid (Production - Recommended)
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxxxx
```

---

## 💰 Cost Summary

| Service | Monthly Cost |
|---------|--------------|
| Frontend | Hostinger (included) |
| Backend (Render Starter) | $7.00 |
| Domain (mysyntromed.com) | ~$1/mo (included) |
| Firebase Spark | Free |
| SSL | Free (Render auto-provisions) |
| **Total** | **~$8/month** |

---

## 🔄 Keeping Backend Awake (Free Tier)

If using Render Free tier (sleeps after 15min), use UptimeRobot:

1. Sign up at [uptimerobot.com](https://uptimerobot.com)
2. Add monitor:
   - Monitor Type: HTTPS(s)
   - Friendly Name: MySyntroMed Backend
   - URL: `https://api.mysyntromed.com/health`
   - Monitoring Interval: 5 minutes
3. This pings your backend every 5 minutes, preventing sleep

**Recommended: Just use Render Starter ($7/mo)** - no uptime robot needed.

---

## Quick Reference

```bash
# Backend URL
https://api.mysyntromed.com

# Health Check
https://api.mysyntromed.com/health

# API Endpoints
POST https://api.mysyntromed.com/api/auth/request-otp
POST https://api.mysyntromed.com/api/auth/verify-otp
POST https://api.mysyntromed.com/api/contact
```
