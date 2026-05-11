# Firebase Setup Instructions

## Step 1: Deploy Firestore Security Rules

1. Go to: https://console.firebase.google.com/project/mysyntromed-81242/firestore/rules

2. You should see the current rules. Replace them with the contents of `firestore.rules` file in this project.

3. Click **"Publish"** button

## Step 2: Create Database Indexes

1. Go to: https://console.firebase.google.com/project/mysyntromed-81242/firestore/indexes

2. Click **"Add Index"** and add these composite indexes:

### Index 1: notifications
- Collection: `notifications`
- Fields: `userId` (Ascending) → `read` (Ascending) → `createdAt` (Descending)

### Index 2: call_offers (for receiver queries)
- Collection: `call_offers`
- Fields: `receiverId` (Ascending) → `status` (Ascending)

### Index 3: call_offers (for caller queries)
- Collection: `call_offers`
- Fields: `callerId` (Ascending) → `status` (Ascending)

### Index 4: ice_candidates
- Collection: `ice_candidates`
- Fields: `receiverId` (Ascending) → `createdAt` (Ascending)

### Index 5: users (for role queries)
- Collection: `users`
- Fields: `role` (Ascending)

## Or use Firebase CLI (Recommended)

1. Install Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Login:
```bash
firebase login
```

3. Deploy rules and indexes:
```bash
cd "/Users/thompsonfadaisi/Downloads/mysyntromed 2"
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

## After Setup

Once rules and indexes are deployed, the call functionality should work properly.