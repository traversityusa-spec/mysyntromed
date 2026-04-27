# 🚀 Automated Firebase Cloud Run Deployment Guide

## Quick Start (Fully Automated)

### Option 1: Simple One-Command Deployment ✨
```bash
cd backend
npm run deploy
```

This will:
1. ✓ Build your backend
2. ✓ Install Firebase tools
3. ✓ Create firebase.json configuration
4. ✓ Prompt you to login to Firebase (one-time)
5. ✓ Deploy automatically to Cloud Run

---

## Step-by-Step Automated Deployment

### Step 1: Prepare (One-time setup)
```bash
cd backend
npm run deploy:prep
```

**What it does:**
- Builds TypeScript → JavaScript
- Installs Firebase tools locally
- Creates `firebase.json` configuration
- Verifies Docker is available
- Checks all prerequisites

### Step 2: Authenticate (One-time setup)
```bash
npx firebase login
```

**This will:**
- Open your browser
- Ask you to sign in to Google
- Save your authentication token locally (~/.config/firebase/)
- You only need to do this ONCE

### Step 3: Deploy to Cloud Run
```bash
npm run deploy
```

Or manually:
```bash
npx firebase deploy --only hosting
```

**What happens:**
- Firebase builds your Docker image
- Uploads to Google Cloud
- Deploys to Cloud Run
- Provides your public URL (usually takes 2-3 minutes)

---

## Fully Automated CI/CD (GitHub Actions)

If you push to GitHub, deployments happen automatically!

### Setup (One-time):

1. **Create Service Account**
   ```bash
   gcloud iam service-accounts create firebase-deployer \
     --display-name="Firebase Deployer"
   
   gcloud projects add-iam-policy-binding mysyntromed-81242 \
     --member="serviceAccount:firebase-deployer@mysyntromed-81242.iam.gserviceaccount.com" \
     --role="roles/run.admin"
   
   gcloud iam service-accounts keys create key.json \
     --iam-account=firebase-deployer@mysyntromed-81242.iam.gserviceaccount.com
   ```

2. **Add Secret to GitHub**
   - Go to GitHub repo → Settings → Secrets
   - Create `GCLOUD_AUTH` secret
   - Paste contents of `key.json`
   - Delete local `key.json` file

3. **That's it!** 

Every push to `main` branch will automatically deploy.

---

## Available Commands

```bash
# Prepare for deployment (build + setup)
npm run deploy:prep

# Deploy using Firebase CLI
npm run deploy:firebase

# Deploy using gcloud directly (if you have gcloud CLI)
npm run deploy:gcloud

# One-command deployment (prep + firebase)
npm run deploy
```

---

## Deployment URLs

After deployment, your backend will be available at:

```
https://mysyntromed-backend-XXXXX.run.app
```

### Connect to Frontend

Update your frontend `.env`:
```env
VITE_API_BASE_URL=https://mysyntromed-backend-XXXXX.run.app
```

Or set up custom domain:
```
api.mysyntromed.com → Cloud Run service
```

---

## Troubleshooting

### "firebase: command not found"
```bash
# Use npx instead
npx firebase --version
```

### "Permission denied" for npm install
```bash
# Install locally instead of globally
npm install firebase-tools --save-dev
```

### Docker build fails
```bash
# Make sure Docker Desktop is running
docker --version
```

### Still stuck?
```bash
# Check what's configured
npx firebase projects:list
npx firebase apps:list
```

---

## Cost

✅ **Stays within FREE TIER:**
- 2M requests/month (usually ample for API)
- 2M vCPU-seconds/month
- 5GB network egress
- Your app uses ~256MB memory

---

## Monitor Deployments

View logs and status:
```bash
# Using Firebase
npx firebase deploy --only hosting

# Using gcloud
gcloud run services describe mysyntromed-backend

# View logs
gcloud run services logs read mysyntromed-backend --limit 50
```

---

## Next Steps

1. Run `npm run deploy:prep` to prepare
2. Run `npx firebase login` to authenticate
3. Run `npm run deploy` to deploy
4. Copy the URL and test your API
5. Update frontend `.env` with the new URL

**Done!** 🎉
