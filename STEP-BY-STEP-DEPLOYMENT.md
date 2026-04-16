# MySyntroMed - Complete Deployment Guide (Step by Step)

This guide will help you deploy your fullstack web application for **FREE** so you can show the owner it's working 100%.

---

## OVERVIEW: What We're Deploying

| Component | Platform | Free Tier |
|-----------|----------|-----------|
| Frontend (React app) | Firebase Hosting | 10GB storage |
| Backend (Node/Express) | Railway | 500 hours/month |
| Database | Firebase Firestore | 1GB storage (already set up) |

---

## PHASE 1: Prepare Your Repository

### Step 1.1: Push Code to GitHub

1. Go to [github.com](https://github.com) and sign in (or create account)

2. Click **"+"** (top right) → **"New repository"**

3. Name it: `mysyntromed`

4. Select **"Public"** (free hosting requires public, or use private + GitHub Pro)

5. Click **"Create repository"**

6. Go back to your terminal and run these commands:

```bash
cd /Users/thompsonfadaisi/Downloads/mysyntromed\ 2

# Initialize git (if not already initialized)
git init

# Add all files
git add .

# Commit
git commit -m "MySyntroMed - Production ready"

# Add GitHub repository (replace with YOUR repo URL)
git remote add origin https://github.com/YOUR_USERNAME/mysyntromed.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Wait for push to complete!**

---

## PHASE 2: Deploy Backend to Railway

### Step 2.1: Create Railway Account

1. Open browser → Go to [railway.app](https://railway.app)

2. Click **"Login"** → Choose **"Login with GitHub"**

3. Authorize Railway to access your GitHub repos

### Step 2.2: Create New Project

1. Click **"New Project"** button (blue)

2. Select **"Deploy from GitHub repo"**

3. Find and select your **"mysyntromed"** repository

4. Railway will scan and detect it's a Node.js project

### Step 2.3: Add Environment Variables

1. In your Railway project, click on **"Settings"** tab

2. Scroll to **"Environment Variables"**

3. Click **"Add Variable"** and add each of these:

```
PORT = 3001
FRONTEND_ORIGIN = https://mysyntromed.web.app
FIREBASE_PROJECT_ID = mysyntromed-81242
SERVICE_ACCOUNT_PATH = ./serviceAccountKey.json
NODE_ENV = production
```

### Step 2.4: Upload Firebase Service Account Key

1. Go to Firebase Console: [console.firebase.google.com](https://console.firebase.google.com)

2. Select project: **"mysyntromed-81242"**

3. Click **Settings (gear icon)** → **"Project settings"**

4. Scroll to **"Service accounts"**

5. Click **"Generate new private key"**

6. Click **"Generate key"** → file downloads

7. Open the downloaded JSON file with a text editor (VS Code, TextEdit, Notepad)

8. Copy the ENTIRE contents of that file

9. Back in Railway Settings → **"Add Variable"**:

```
Variable Name: SERVICE_ACCOUNT_KEY
Value: [PASTE THE ENTIRE JSON CONTENTS HERE]
```

**⚠️ Important:** The JSON should look like this (one long line):
```
{"type":"service_account","project_id":"mysyntromed-81242",...}
```

### Step 2.5: Configure Start Command

1. In Railway, go to **"Settings"** → **"Start Command"**

2. Leave as default or set: `npm start`

### Step 2.6: Wait for Deployment

1. Go to **"Deployments"** tab

2. Wait for the build to complete (green checkmark)

3. You'll see a URL like: `https://mysyntromed-backend.up.railway.app`

**📝 SAVE THIS URL! You'll need it for Step 3.4**

---

## PHASE 3: Deploy Frontend to Firebase

### Step 3.1: Update Frontend API URL

1. Open file: `frontend/.env`

2. Replace the Railway URL with YOUR actual Railway URL:

```
VITE_API_BASE_URL=https://mysyntromed-backend.up.railway.app/api
```

(Replace `mysyntromed-backend.up.railway.app` with YOUR actual Railway URL!)

3. Save the file

4. Commit and push to GitHub:
```bash
git add .
git commit -m "Update API URL for production"
git push
```

### Step 3.2: Install Firebase CLI

```bash
npm install -g firebase-tools
```

### Step 3.3: Login to Firebase

```bash
firebase login
```

- Browser opens → Select your Google account
- Click **"Allow"**
- Return to terminal

### Step 3.4: Initialize Firebase Hosting

```bash
cd frontend
firebase init hosting
```

**Answer the questions:**

```
? What do you want to use as your public directory? dist
? Configure as a single-page app? Yes
? Set up automatic builds? No (or Yes if using GitHub Actions)
? File dist/index.html already exists. Overwrite? No
```

### Step 3.5: Update Firebase Config (if needed)

Check `firebase.json` - it should have:
```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

### Step 3.6: Deploy!

```bash
firebase deploy
```

**🎉 Your site is LIVE!**

You'll see output like:
```
✔  Deploy complete!

Hosting URL: https://mysyntromed.web.app
```

---

## PHASE 4: Verify Everything Works

### Step 4.1: Test the Website

1. Open your Firebase Hosting URL in browser

2. Test these features:

| Test | What to Check |
|------|---------------|
| Homepage | Landing page loads correctly |
| Client Login | Can log in with email/password |
| Specialist Login | Can access specialist portal |
| Admin Login | Can access admin portal |
| Create User (Admin) | Admin can create new users |
| Send Message | Messages send and receive |
| Real-time Updates | Dashboard updates automatically |

### Step 4.2: Configure Firebase Authorized Domains

1. Go to [Firebase Console](https://console.firebase.google.com)

2. Select project → **"Authentication"** → **"Settings"**

3. Scroll to **"Authorized domains"**

4. Click **"Add domain"**

5. Add your Firebase Hosting domain:
   ```
   mysyntromed.web.app
   ```

6. Also add your Railway backend domain:
   ```
   mysyntromed-backend.up.railway.app
   ```

---

## PHASE 5: Create Test Accounts

Since this is a demo, you need admin accounts to show the owner.

### Step 5.1: Create Admin User via Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com)

2. Select project → **"Authentication"** → **"Users"**

3. Click **"Add user"**

4. Enter:
   - Email: `admin@mysyntromed.com`
   - Password: `Admin123!@#`

5. Click **"Create user"**

### Step 5.2: Set Admin Role in Firestore

1. In Firebase Console → **"Firestore Database"**

2. Click **"Start collection"**

3. Collection ID: `users`

4. Document ID: (paste the User UID from Step 5.1)

5. Add these fields:
   ```
   uid: [paste the User UID]
   displayName: "Admin User"
   email: "admin@mysyntromed.com"
   role: "admin"
   isNewUser: false
   createdAt: [current timestamp]
   updatedAt: [current timestamp]
   ```

6. Click **"Save"**

### Step 5.3: Repeat for Specialist Account

1. Create user: `specialist@mysyntromed.com` / `Specialist123!@#`

2. Set role as `"specialist"` in Firestore

### Step 5.4: Test All Logins

1. Go to your website
2. Test admin login at `/admin`
3. Test specialist login at `/specialist`
4. Test client login at `/`

---

## FINAL: Share with Owner

Your demo is ready!

**Website URL:** `https://mysyntromed.web.app`

**Test Accounts:**

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@mysyntromed.com | Admin123!@# |
| Specialist | specialist@mysyntromed.com | Specialist123!@# |
| Client | (create via admin panel) | - |

---

## TROUBLESHOOTING

### Backend shows 500 error
- Check Railway logs (click on deployment → View Logs)
- Verify all environment variables are set correctly
- Make sure SERVICE_ACCOUNT_KEY has valid JSON

### Login doesn't work
- Add your hosting domains to Firebase Authorized domains (Step 4.2)
- Check browser console for errors

### Messages don't send
- Verify Railway backend is awake (first request takes 10-15 sec)
- Check Railway logs for email server errors

### CORS errors
- Make sure `FRONTEND_ORIGIN` in Railway matches your Firebase URL exactly
- Include `https://` and no trailing slash

---

## COST SUMMARY

| Service | Monthly Cost | Usage |
|---------|--------------|-------|
| Firebase Hosting | $0 | 10GB free |
| Firebase Firestore | $0 | 1GB free |
| Railway | $0 | 500 hours free |
| GitHub | $0 | Unlimited repos |
| **TOTAL** | **$0** | **Demo ready!** |

---

**🎊 Congratulations! Your MySyntroMed website is now live and working!**
