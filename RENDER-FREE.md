# MySyntroMed - Render Free Tier Deployment

## ⚠️ Important: Free Tier Limitations

| Feature | Free Tier | Starter ($7/mo) |
|---------|-----------|-----------------|
| Sleep after inactivity | **15 minutes** | No sleep |
| Monthly hours | 750 hours | Unlimited |
| Cold start | ~30 seconds | Instant |
| Custom domain | ✅ | ✅ |
| SSL | ✅ | ✅ |

**Free tier WILL sleep after 15 min of no traffic.**

---

## Solution: UptimeRobot (Free) to Keep Backend Awake

We'll set up a free monitoring service to ping your backend every 5 minutes, preventing it from sleeping.

---

## Step 1: Deploy Backend to Render (Free Tier)

### 1.1: Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up with GitHub

### 1.2: Create New Web Service
1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Select **mysyntromed** repo
4. Configure:

```
Name: mysyntromed-backend
Root Directory: backend
Runtime: Node
Build Command: npm install && npm run build
Start Command: npm start
Plan: Free
```

### 1.3: Add Environment Variables

Click **"Environment"** tab and add:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `FRONTEND_ORIGIN` | `https://mysyntromed.com` |
| `FIREBASE_PROJECT_ID` | `mysyntromed-81242` |
| `SERVICE_ACCOUNT_KEY` | `{...paste entire JSON...}` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `your-email@gmail.com` |
| `SMTP_PASS` | `your-app-password` |
| `SMTP_FROM` | `MySyntroMed <noreply@mysyntromed.com>` |

### 1.4: Get Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Project Settings → Service Accounts
3. **"Generate new private key"**
4. Copy entire JSON
5. Paste as `SERVICE_ACCOUNT_KEY` value

### 1.5: Deploy
1. Click **"Create Web Service"**
2. Wait for build (~2 minutes)
3. Copy your URL: `https://mysyntromed-backend.onrender.com`

---

## Step 2: Keep Backend Awake (UptimeRobot)

### 2.1: Create UptimeRobot Account
1. Go to [uptimerobot.com](https://uptimerobot.com)
2. Click **"Sign Up Free"**
3. Verify email

### 2.2: Add Monitor
1. Click **"+ Add New Monitor"**
2. Configure:

```
Monitor Type: HTTP(s)
Friendly Name: MySyntroMed Backend
URL: https://mysyntromed-backend.onrender.com/health
Monitoring Interval: 5 minutes
```

3. Click **"Create Monitor"**

### 2.3: How It Works
- UptimeRobot pings `/health` every 5 minutes
- This counts as traffic → Render never sleeps
- Your backend stays awake 24/7
- **Cost: FREE**

---

## Step 3: Custom Domain (Optional)

### 3.1: In Render Dashboard
1. Your service → **Settings**
2. Scroll to **Custom Domains**
3. Click **"Add Custom Domain"**
4. Enter: `api.mysyntromed.com`

### 3.2: In Hostinger DNS
Add CNAME record:
```
Type    Name    Value
CNAME   api     mysyntromed-backend.onrender.com
```

### 3.3: Wait for SSL
Render auto-provisions SSL (5-10 min)

---

## Step 4: Deploy Frontend to Hostinger

### 4.1: Build Frontend
```bash
cd frontend
npm install
npm run build
```

### 4.2: Upload
1. Hostinger File Manager → `public_html`
2. Upload contents of `frontend/dist`
3. Clear cache if needed

### 4.3: Update API URL
Make sure `frontend/.env` has:
```env
VITE_API_BASE_URL=https://mysyntromed-backend.onrender.com
```
Or if using custom domain:
```env
VITE_API_BASE_URL=https://api.mysyntromed.com
```

---

## Step 5: Firebase Configuration

### Add Authorized Domains
1. [Firebase Console](https://console.firebase.google.com)
2. **Authentication** → **Settings** → **Authorized domains**
3. Add:
   - `mysyntromed.com`
   - `www.mysyntromed.com`
   - `mysyntromed-backend.onrender.com`
   - `api.mysyntromed.com` (if using custom domain)

---

## Step 6: Verify Everything

### Test Backend
```bash
curl https://mysyntromed-backend.onrender.com/health
```
Result: `{"ok":true,"service":"backend"}`

### Test Website
Open: `https://mysyntromed.com`

---

## ⚠️ Important Notes

### First Request Delay
- After 15 min of no traffic, first request takes ~30 seconds (cold start)
- UptimeRobot prevents this by keeping backend warm
- First ping may timeout - that's OK, next one will succeed

### Monitoring Dashboard
Check UptimeRobot dashboard to see:
- How often your backend is being pinged
- Uptime percentage
- Response times

### Render Sleep Warning
If you see "Your service is sleeping", wait 30 seconds and refresh. UptimeRobot will wake it.

---

## 📁 Files Structure

```
mysyntromed/
├── frontend/          # Deploy to Hostinger
├── backend/           # Deploy to Render
├── firestore.rules    # Deploy with firebase CLI
├── render.yaml        # Render auto-deploy config
└── RENDER-FREE.md    # This file
```

---

## 💰 Cost Summary

| Service | Monthly Cost |
|---------|--------------|
| Frontend | Hostinger (included) |
| Backend (Render Free) | $0 |
| UptimeRobot | $0 |
| Firebase Spark | $0 |
| **Total** | **$0/month** |

---

## Quick Commands Reference

```bash
# Check backend health
curl https://mysyntromed-backend.onrender.com/health

# Rebuild frontend
cd frontend && npm run build
```
