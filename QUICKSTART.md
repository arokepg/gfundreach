# Quick Start Guide - Gfundreach

## 🚀 Getting Started in 5 Minutes

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Firebase

**Important:** You must set up Firebase before the app will work!

1. Follow the detailed guide in `FIREBASE_SETUP.md`
2. Update `src/config/firebase.js` with your Firebase credentials

Quick version:
- Create a Firebase project
- Enable Authentication (Email/Password + Google)
- Create Firestore database
- Enable Storage
- Copy your config to `src/config/firebase.js`

### 3. Start Development Server
```bash
npm run dev
```

Open http://localhost:5173 in your browser

### 4. (Optional) Start Backend Server
```bash
npm run server
```

Backend API runs on http://localhost:5000

## 📝 First Steps

### Create an Account
1. Click "Sign up" on the login page
2. Enter your name, email, and password
3. Or use "Continue with Google"

### Explore the Platform
1. **Home Feed** - Browse fundraising campaigns
2. **Create Campaign** - Click "+ Create Post" to start your fundraiser
3. **Wallet** - Top up your wallet to make donations
4. **Profile** - View your campaigns and donation history

### Make a Donation
1. Click on any campaign from the home feed
2. Enter donation amount and optional message
3. Click "Donate Now"

### Create a Campaign
1. Click "+ Create Post" in the navigation
2. Fill in campaign details:
   - Title
   - Category
   - Fundraising goal
   - Description
   - Upload an image (optional)
3. Click "Create Campaign"

## 🎯 Key Features to Try

### Wallet System
- Top up your wallet from the Wallet page
- View transaction history
- Track donations sent and received

### User Profile
- View your campaigns
- See donation statistics
- Track total donated and received

### Campaign Management
- Create campaigns with images
- Track fundraising progress
- View supporters count

## 🐛 Common Issues

### "Firebase not configured" error
**Solution:** Update `src/config/firebase.js` with your Firebase credentials

### "Permission denied" in Firestore
**Solution:** Check that security rules are set up correctly in Firebase Console

### Images not uploading
**Solution:** 
- Check Storage is enabled in Firebase
- Verify storage rules allow writes
- Ensure image is under 10MB

### Can't log in
**Solution:**
- Verify Authentication is enabled in Firebase Console
- Check that Email/Password provider is enabled
- Clear browser cache

## 📚 Project Structure

```
src/
├── components/         # Reusable components
│   ├── Navbar.jsx     # Navigation bar
│   └── ProtectedRoute.jsx  # Auth guard
├── config/            # Configuration
│   └── firebase.js    # Firebase setup (UPDATE THIS!)
├── contexts/          # React contexts
│   └── AuthContext.jsx  # Authentication state
├── pages/             # Page components
│   ├── Login.jsx      # Login page
│   ├── Register.jsx   # Registration page
│   ├── Home.jsx       # Main feed
│   ├── CreatePost.jsx # Create campaign
│   ├── PostDetail.jsx # Campaign details
│   ├── Profile.jsx    # User profile
│   └── Wallet.jsx     # Wallet & transactions
└── App.jsx            # Main app with routing
```

## 🎨 Customization

### Change Color Scheme
Edit `tailwind.config.js` to change the Material 3 colors:
```javascript
colors: {
  primary: { DEFAULT: '#6750A4', ... },
  secondary: { DEFAULT: '#625B71', ... },
  tertiary: { DEFAULT: '#7D5260', ... },
}
```

### Add New Pages
1. Create component in `src/pages/`
2. Add route in `src/App.jsx`
3. Add navigation link in `src/components/Navbar.jsx`

### Modify Styles
- Global styles: `src/index.css`
- Component styles: Use Tailwind classes
- Custom utilities: Define in `tailwind.config.js`

## 📱 Development Tips

### Hot Module Replacement (HMR)
Vite automatically reloads when you save changes. No need to refresh!

### React DevTools
Install React Developer Tools browser extension for debugging

### Firebase Emulator Suite
For local development without using production Firebase:
```bash
firebase emulators:start
```

### Code Formatting
Use Prettier and ESLint:
```bash
npm run lint
```

## 🚢 Deployment

### Build for Production
```bash
npm run build
```

### Deploy to Firebase Hosting
```bash
firebase deploy
```

### Deploy Backend to Heroku/Railway/Render
1. Add start script to package.json
2. Set environment variables
3. Deploy using platform CLI

## 📖 Learn More

- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [TailwindCSS Documentation](https://tailwindcss.com)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Material-UI Documentation](https://mui.com)

## 🤝 Need Help?

1. Check `README.md` for detailed documentation
2. Review `FIREBASE_SETUP.md` for Firebase configuration
3. Look at the code comments in components
4. Open an issue on GitHub

## ✨ Pro Tips

- Use Chrome DevTools Network tab to debug API calls
- Check Firebase Console for real-time database updates
- Use React DevTools to inspect component state
- Test authentication with different browsers for Google OAuth
- Monitor Firebase usage in the Usage tab

Happy coding! 🎉
