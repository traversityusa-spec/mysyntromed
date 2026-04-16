# Deployment Guide for MySyntroMed

## Free Deployment Stack
- **Frontend**: Firebase Hosting (Free tier: 10GB storage, 360MB/day bandwidth)
- **Backend**: Railway (Free tier: 500 hours/month, sleep after 30min inactivity)
- **Database**: Firebase Firestore (Free tier: 1GB storage, 50K reads/day)

---

## Step 1: Deploy Backend to Railway

1. Go to [railway.app](https://railway.app) and sign up (use GitHub)

2. Click "New Project" → "Deploy from GitHub repo"

3. Select this repository

4. Railway will auto-detect Node.js. Add these Environment Variables:
   ```
   PORT=3001
   FRONTEND_ORIGIN=https://mysyntromed.web.app
   FIREBASE_PROJECT_ID=mysyntromed-81242
   SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
   ```

5. For `SERVICE_ACCOUNT_KEY`, copy the contents of `backend/serviceAccountKey.json` and add it as a Railway secret

6. Once deployed, Railway gives you a URL like: `https://mysyntromed-backend.up.railway.app`

7. Update `frontend/.env` with your Railway URL:
   ```
   VITE_API_BASE_URL=https://your-railway-url.up.railway.app/api
   ```

---

## Step 2: Deploy Frontend to Firebase

1. Install Firebase CLI (if not installed):
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Build the frontend:
   ```bash
   cd frontend
   npm run build
   ```

4. Deploy:
   ```bash
   firebase deploy
   ```

5. Your site will be live at: `https://mysyntromed.web.app`

---

## Step 3: Verify Everything Works

1. Open your Firebase Hosting URL
2. Test login flows (Client, Specialist, Admin)
3. Test messaging between users
4. Test admin user creation

---

## Costs (Free Tier Limits)

| Service | Free Limit | Notes |
|---------|-----------|-------|
| Firebase Hosting | 10GB storage, 360MB/day | More than enough for demo |
| Firebase Firestore | 1GB storage | Use sparingly |
| Railway | 500 hours/month | Backend sleeps after 30min inactive |
| Railway (Bandwidth) | 100GB/month | Good for demo |

---

## Custom Domain (Optional)

Both Firebase Hosting and Railway support free custom domains:
- Firebase: Add in Hosting settings → Connect domain
- Railway: Project Settings → Domains → Add domain

---

## Troubleshooting

**Backend not responding?**
- Check Railway logs for errors
- Verify environment variables are set
- Railway spins down after 30min - first request may take 10-15 seconds

**Firebase auth not working?**
- Ensure authorized domains include your Firebase Hosting URL in Firebase Console → Authentication → Settings → Authorized domains
