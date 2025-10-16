## 🚀 Quick Deployment Steps

### ✅ Step 1: Update Git Configuration (if needed)
```powershell
git config --global user.email "your-actual-email@example.com"
git config --global user.name "Your Actual Name"
```

### ✅ Step 2: Commit Your Changes
```powershell
git commit -m "Add Vercel deployment configuration and new pages"
```

### ✅ Step 3: Push to GitHub
```powershell
git push origin master
```

### ✅ Step 4: Deploy to Vercel

#### Option A: Vercel Dashboard (Easiest)
1. Visit https://vercel.com/new
2. Sign in with GitHub
3. Click "Import Project"
4. Select `gfundreach` repository
5. Add Environment Variables:
   ```
   VITE_FIREBASE_API_KEY=AIzaSyCpiVx8ZHPuTwlj5E3Yy2TrVFtjxsp4L-E
   VITE_FIREBASE_AUTH_DOMAIN=gfundreach.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=gfundreach
   VITE_FIREBASE_STORAGE_BUCKET=gfundreach.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=117924750009
   VITE_FIREBASE_APP_ID=1:117924750009:web:1b2b9d96b1eabea8d1f168
   VITE_FIREBASE_MEASUREMENT_ID=G-2NTNXDWEXH
   ```
6. Click "Deploy"

#### Option B: Vercel CLI
```powershell
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

### ✅ Step 5: Update Firebase Authorized Domains
1. Go to Firebase Console: https://console.firebase.google.com/project/gfundreach/authentication/settings
2. Scroll to "Authorized domains"
3. Click "Add domain"
4. Add your Vercel URL (e.g., `gfundreach.vercel.app`)

## 📦 What's Been Set Up

✅ `vercel.json` - Vercel deployment configuration
✅ `.vercelignore` - Files to exclude from deployment
✅ `.env.example` - Environment variables template
✅ `VERCEL_DEPLOYMENT.md` - Complete deployment guide
✅ Updated `firebase.js` - Now uses environment variables
✅ New pages created: Explore, Saved, Group

## 🎯 Next Actions

Run these commands now:

```powershell
# 1. Update your git email and name (replace with your actual info)
git config --global user.email "your-email@gmail.com"
git config --global user.name "Your Name"

# 2. Commit changes
git commit -m "Add Vercel deployment configuration and new pages"

# 3. Push to GitHub
git push origin master

# 4. Then go to vercel.com to deploy!
```

## 🔒 Security Note
Your Firebase credentials are now in `.env.example`. The hardcoded values in `firebase.js` serve as fallbacks for local development, but you should add environment variables in Vercel for production.
