# MySyntroMed - Production Deployment Guide

## ⚠️ IMPORTANT: Railway Free Tier Sleeps!

Railway's free tier sleeps after 30 minutes of inactivity. For production, use one of these options:

| Provider | Free Tier | Always-On | Recommended For |
|---------|-----------|-----------|----------------|
| **Render** | 750 hrs/month | ❌ Sleeps after 15min | Testing/Dev |
| **Railway** | 500 hrs/month | ❌ Sleeps after 30min | Testing/Dev |
| **Fly.io** | 3 shared VMs | ✅ Yes | Production |
| **DigitalOcean App** | $5/month | ✅ Yes | Production |
| **AWS ECS** | Free tier | ✅ Yes | Enterprise |
| **VPS (Linode/DO)** | $4-6/month | ✅ Yes | Production |

---

## 🏆 RECOMMENDED: DigitalOcean App Platform ($5/month)

DigitalOcean App Platform has a $5/month tier that stays awake 24/7 and includes:
- Always-on container
- Free SSL
- Custom domain
- Automatic deployments

### Step 1: Create DigitalOcean Account
1. Go to [digitalocean.com](https://digitalocean.com)
2. Sign up for App Platform
3. Add payment method (required for App Platform)

### Step 2: Deploy Backend
1. Click **"Apps"** → **"Create App"**
2. Select **"GitHub"** as source
3. Select your repository
4. Choose **Backend** folder or set root directory
5. **Build Command:** `npm install && npm run build`
6. **Run Command:** `npm start`
7. Add Environment Variables:

```
NODE_ENV=production
PORT=3001
FRONTEND_ORIGIN=https://your-frontend-domain.com
FIREBASE_PROJECT_ID=mysyntromed-81242
SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
SERVICE_ACCOUNT_KEY={"type":"service_account",...}
EMAIL_SERVER_URL=https://your-email-server.com
EMAIL_SERVICE_KEY=your-email-service-key
```

8. Click **"Create Resources"**

### Step 3: Get Your Backend URL
After deployment, you'll see: `https://mysyntromed-backend-xxxxx.ondigitalocean.app`

### Step 4: Update Frontend
Update `frontend/.env`:
```
VITE_API_BASE_URL=https://your-backend-url.on.digitalocean.app/api
```

### Step 5: Deploy Frontend to Your Hosting
Build and deploy according to your hosting provider's instructions.

---

## 🆓 FREE ALTERNATIVE: Fly.io (Always-On)

Fly.io offers 3 shared VMs free forever that stay awake!

### Step 1: Install Fly CLI
```bash
brew install flyctl
fly auth login
```

### Step 2: Create Dockerfile in Backend
Create `backend/Dockerfile`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3001
CMD ["npm", "start"]
```

### Step 3: Deploy
```bash
cd backend
fly launch
fly secrets set NODE_ENV=production
fly secrets set FIREBASE_PROJECT_ID=mysyntromed-81242
fly secrets set FRONTEND_ORIGIN=https://your-domain.com
fly secrets set SERVICE_ACCOUNT_KEY="$(cat serviceAccountKey.json)"
fly deploy
```

---

## 🔒 SECURITY CHECKLIST

Before going live, ensure:

- [ ] **Firebase App Check Enabled**
  - Go to Firebase Console → App Check
  - Register your app with reCAPTCHA Enterprise
  - Add VITE_RECAPTCHA_SITE_KEY to frontend env

- [ ] **API Key Restrictions**
  - Go to Google Cloud Console
  - Restrict API key to your domains only
  - Enable App Check enforcement on Firestore

- [ ] **Firestore Rules Deployed**
  - Run: `firebase deploy --only firestore:rules`
  - Rules now block OTP code access

- [ ] **Environment Variables Secured**
  - Never commit `.env` files
  - Use secret managers in production

- [ ] **Rate Limiting Active**
  - Backend has rate limits enabled
  - Monitor for abuse

---

## 📧 EMAIL SETUP

### Option 1: SendGrid (Free tier: 100 emails/day)
1. Sign up at sendgrid.com
2. Create API key
3. Add to backend environment:
```
EMAIL_SERVICE_KEY=SG.xxxxxxxx
```

### Option 2: Gmail SMTP (Limited)
For small scale, use Gmail App Passwords:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### Option 3: Mailgun (Free tier: 5,000 emails/month)
1. Sign up at mailgun.com
2. Add SMTP credentials to backend

---

## 🚀 POST-DEPLOYMENT

### Verify Backend Health
```bash
curl https://your-backend-url.com/health
```

### Check Logs
In your hosting dashboard, check application logs for any errors.

### Test All Features
- [ ] User registration/login
- [ ] Admin user creation
- [ ] Messaging between users
- [ ] Notifications appear
- [ ] Scheduled calls work
- [ ] Contact form sends emails

### Monitor Performance
Set up free monitoring:
- [UptimeRobot](https://uptimerobot.com) - Free uptime monitoring
- [LogRocket](https://logrocket.com) - Error tracking (free tier available)
- [Firebase Analytics](https://console.firebase.google.com) - Usage monitoring

---

## 📞 SUPPORT

For issues:
1. Check hosting provider's logs
2. Verify all environment variables
3. Ensure Firestore rules are deployed
4. Test API endpoints with curl

---

## 💰 COST ESTIMATES (Production)

| Service | Monthly Cost |
|---------|--------------|
| Frontend Hosting | $0-10 (varies by provider) |
| Backend Hosting | $5-10 |
| Firebase (Spark Plan) | $0 (free tier) |
| Email Service | $0-20 |
| Domain | $10-15/year |
| **Total** | **$10-50/month** |
