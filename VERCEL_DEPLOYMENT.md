# Vercel Deployment Guide for Gfundreach

## Prerequisites
- GitHub account
- Vercel account (sign up at [vercel.com](https://vercel.com))
- Firebase project configured

## Step 1: Configure Environment Variables

Before deploying, you need to set up your Firebase environment variables in Vercel.

Your Firebase config variables (from `src/config/firebase.js`):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

## Step 2: Push Code to GitHub

```bash
# Add all changes
git add .

# Commit changes
git commit -m "Add Vercel deployment configuration"

# Push to GitHub
git push origin master
```

## Step 3: Deploy to Vercel

### Option A: Using Vercel Dashboard (Recommended for first deployment)

1. Go to [vercel.com](https://vercel.com) and sign in with your GitHub account
2. Click **"Add New Project"** or **"Import Project"**
3. Select your `gfundreach` repository from GitHub
4. Vercel will auto-detect the framework settings:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build` (or `vite build`)
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

5. **Add Environment Variables:**
   - Click on "Environment Variables"
   - Add each Firebase variable:
     ```
     VITE_FIREBASE_API_KEY=your_api_key
     VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
     VITE_FIREBASE_PROJECT_ID=your_project_id
     VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
     VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
     VITE_FIREBASE_APP_ID=your_app_id
     ```

6. Click **"Deploy"**

### Option B: Using Vercel CLI

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Deploy (first time)
vercel

# Deploy to production
vercel --prod
```

## Step 4: Configure Firebase Authentication

After deployment, you need to add your Vercel domain to Firebase:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to **Authentication > Settings > Authorized domains**
4. Click **"Add domain"**
5. Add your Vercel domain (e.g., `gfundreach.vercel.app`)

## Step 5: Test Your Deployment

1. Visit your deployed URL (e.g., `https://gfundreach.vercel.app`)
2. Test user registration and login
3. Test creating posts
4. Verify Firebase authentication works

## Automatic Deployments

Vercel will automatically deploy:
- **Production:** Every push to `master` branch
- **Preview:** Every pull request

## Custom Domain (Optional)

1. In Vercel Dashboard, go to your project
2. Click **"Settings"** > **"Domains"**
3. Add your custom domain
4. Follow the DNS configuration instructions
5. Don't forget to add the custom domain to Firebase authorized domains

## Troubleshooting

### Build Fails
- Check that all dependencies are in `package.json`
- Verify environment variables are set correctly
- Check build logs in Vercel dashboard

### Firebase Authentication Errors
- Ensure Vercel domain is added to Firebase authorized domains
- Verify all Firebase environment variables are set
- Check Firebase console for error logs

### Routing Issues (404 on refresh)
- The `vercel.json` file handles this with rewrites
- All routes redirect to `index.html` for client-side routing

## Files Created for Deployment

✅ `vercel.json` - Vercel configuration
✅ `.vercelignore` - Files to ignore during deployment

## Need Help?

- [Vercel Documentation](https://vercel.com/docs)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)
- [Firebase Auth Documentation](https://firebase.google.com/docs/auth)
