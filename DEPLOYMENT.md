# Deployment Guide - Gfundreach

## 🚀 Deployment Options

This guide covers deploying Gfundreach to various platforms.

---

## Option 1: Firebase Hosting (Recommended for Frontend)

### Prerequisites
- Firebase CLI installed: `npm install -g firebase-tools`
- Firebase project created and configured

### Steps

1. **Login to Firebase**
   ```bash
   firebase login
   ```

2. **Initialize Firebase Hosting**
   ```bash
   firebase init hosting
   ```
   - Select your project
   - Public directory: `dist`
   - Configure as single-page app: `Yes`
   - Set up automatic builds: `No`
   - Don't overwrite index.html: `No`

3. **Build the Application**
   ```bash
   npm run build
   ```

4. **Deploy**
   ```bash
   firebase deploy --only hosting
   ```

5. **Access Your App**
   Your app will be live at: `https://your-project-id.web.app`

### Custom Domain
1. Go to Firebase Console → Hosting
2. Click "Add custom domain"
3. Follow the DNS configuration steps
4. Wait for SSL certificate provisioning (can take up to 24 hours)

---

## Option 2: Vercel (Easy Deployment)

### Via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel
   ```

4. **Production Deployment**
   ```bash
   vercel --prod
   ```

### Via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Import your Git repository
3. Vercel auto-detects Vite
4. Click "Deploy"

### Environment Variables
Add in Vercel Dashboard → Settings → Environment Variables:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- etc.

---

## Option 3: Netlify

### Via Netlify CLI

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Build**
   ```bash
   npm run build
   ```

3. **Deploy**
   ```bash
   netlify deploy --prod --dir=dist
   ```

### Via Netlify Dashboard

1. Go to [netlify.com](https://netlify.com)
2. Connect your Git repository
3. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Click "Deploy site"

### Netlify Configuration

Create `netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

## Backend Deployment

### Option A: Heroku

1. **Install Heroku CLI**
   ```bash
   npm install -g heroku
   ```

2. **Login**
   ```bash
   heroku login
   ```

3. **Create Heroku App**
   ```bash
   heroku create gfundreach-api
   ```

4. **Add Procfile**
   ```
   web: node server/index.js
   ```

5. **Set Environment Variables**
   ```bash
   heroku config:set FIREBASE_PROJECT_ID=your_project_id
   heroku config:set FIREBASE_CLIENT_EMAIL=your_email
   heroku config:set FIREBASE_PRIVATE_KEY="your_private_key"
   ```

6. **Deploy**
   ```bash
   git push heroku main
   ```

### Option B: Railway

1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub"
3. Select your repository
4. Add environment variables
5. Set start command: `node server/index.js`
6. Deploy

### Option C: Render

1. Go to [render.com](https://render.com)
2. Click "New" → "Web Service"
3. Connect your repository
4. Settings:
   - Build Command: `npm install`
   - Start Command: `node server/index.js`
   - Environment: `Node`
5. Add environment variables
6. Deploy

### Option D: DigitalOcean App Platform

1. Go to DigitalOcean → App Platform
2. Create new app from GitHub
3. Configure:
   - Build Command: `npm install`
   - Run Command: `node server/index.js`
4. Add environment variables
5. Deploy

---

## Environment Variables Setup

### Frontend (Vite)
Variables must be prefixed with `VITE_`:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

Update `src/config/firebase.js`:
```javascript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  // ... etc
};
```

### Backend (Node.js)

```env
PORT=5000
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY=your_private_key
NODE_ENV=production
```

---

## Pre-Deployment Checklist

### ✅ Security

- [ ] Firebase security rules are properly configured
- [ ] Environment variables are set (not hardcoded)
- [ ] `.env` files are in `.gitignore`
- [ ] API keys are restricted in Firebase Console
- [ ] Firebase App Check is enabled
- [ ] CORS is properly configured

### ✅ Performance

- [ ] Production build is optimized (`npm run build`)
- [ ] Images are optimized and compressed
- [ ] Lazy loading is implemented where needed
- [ ] Firebase indexes are created
- [ ] CDN is configured for static assets

### ✅ Functionality

- [ ] All features work in production environment
- [ ] Authentication works (email + Google)
- [ ] File uploads work
- [ ] Database operations work
- [ ] Error handling is in place
- [ ] Loading states are implemented

### ✅ SEO & Analytics

- [ ] Meta tags are set
- [ ] Favicon is added
- [ ] Analytics is integrated (Google Analytics, etc.)
- [ ] Social media cards are configured

---

## Post-Deployment

### 1. Test the Deployment

- [ ] Create an account
- [ ] Login/Logout
- [ ] Create a post
- [ ] Upload an image
- [ ] Make a donation
- [ ] Check wallet transactions
- [ ] View profile
- [ ] Test on mobile devices
- [ ] Test on different browsers

### 2. Monitor Performance

**Firebase Console:**
- Usage & Billing
- Authentication activity
- Firestore operations
- Storage usage

**Analytics:**
- Set up Google Analytics
- Monitor user behavior
- Track conversion rates

### 3. Set Up Monitoring

**Sentry (Error Tracking):**
```bash
npm install @sentry/react
```

**LogRocket (Session Replay):**
```bash
npm install logrocket
```

---

## Updating the Deployment

### Continuous Deployment (CD)

**GitHub Actions Example:**

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Firebase

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          # Add other env variables
      
      - name: Deploy to Firebase
        uses: w9jds/firebase-action@master
        with:
          args: deploy --only hosting
        env:
          FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
```

### Manual Updates

1. Pull latest changes
2. Build: `npm run build`
3. Deploy: `firebase deploy` (or your platform's command)

---

## Rollback Strategy

### Firebase Hosting
```bash
firebase hosting:rollback
```

### Vercel
Go to Dashboard → Deployments → Click on previous deployment → "Promote to Production"

### Netlify
Go to Deploys → Click on previous deployment → "Publish deploy"

---

## Domain Configuration

### Add Custom Domain

1. **Purchase Domain** (Namecheap, GoDaddy, Google Domains)

2. **DNS Configuration:**
   - Type: `A`
   - Name: `@`
   - Value: Platform's IP address
   
   - Type: `CNAME`
   - Name: `www`
   - Value: Your platform URL

3. **SSL Certificate**
   Most platforms auto-provision SSL certificates. Wait 24-48 hours.

---

## Cost Optimization

### Firebase

**Free Tier Limits:**
- Firestore: 50K reads, 20K writes, 20K deletes per day
- Storage: 5GB, 1GB/day downloads
- Hosting: 10GB/month bandwidth

**Optimization Tips:**
- Use pagination for large queries
- Implement caching
- Optimize images before upload
- Use Cloud Functions sparingly
- Monitor usage regularly

### Backend Hosting

**Free Tiers:**
- **Heroku**: 550-1000 dyno hours/month
- **Railway**: $5 free credit/month
- **Render**: 750 hours/month free

---

## Troubleshooting Deployment

### Build Fails

**Check:**
- Node version compatibility
- All dependencies installed
- Environment variables set
- No TypeScript/ESLint errors

### App Loads But Features Don't Work

**Check:**
- Firebase config is correct
- Environment variables are prefixed with `VITE_`
- API endpoints are correct
- CORS is enabled on backend

### Authentication Doesn't Work

**Check:**
- Authorized domains in Firebase Console
- Redirect URIs are correct
- OAuth consent screen is configured

### Images Don't Upload

**Check:**
- Storage rules allow writes
- File size under limit
- CORS configuration in Storage

---

## Support & Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)
- [Vercel Documentation](https://vercel.com/docs)
- [Netlify Documentation](https://docs.netlify.com)

---

## 🎉 Congratulations!

Your Gfundreach application is now live and ready to help connect donors with those in need!

For issues or questions, please refer to the main README.md or open an issue on GitHub.
