# Gfundreach - Social Fundraising Platform

A modern, interactive social media platform for fundraising that connects people in need with generous donors. Built with React, TailwindCSS, Firebase, and Express.js.

## 🌟 Features

- **User Authentication**: Secure login/signup with email or Google OAuth
- **Social Feed**: Browse fundraising campaigns like a social media feed
- **Create Campaigns**: Share your story and start raising funds
- **Secure Donations**: Built-in wallet system for safe transactions
- **User Profiles**: Track your donations and campaigns
- **Real-time Updates**: Powered by Firebase Firestore
- **Material Design 3**: Beautiful, modern UI with Google's Material Design color scheme

## 🎨 Design

The UI is designed following Material Design 3 principles with a custom color scheme:
- Primary: Purple (`#6750A4`)
- Secondary: Gray-Purple (`#625B71`)
- Tertiary: Rose (`#7D5260`)

Design prototype: [Figma Design](https://www.figma.com/design/K9Ev8RXEEskoVsBBo3saBx/Gfundreach)

## 🚀 Tech Stack

### Frontend
- **React** - UI library
- **Vite** - Build tool and dev server
- **TailwindCSS** - Utility-first CSS framework
- **Material-UI** - Component library and icons
- **React Router** - Client-side routing
- **Firebase SDK** - Authentication, Firestore, Storage

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **Firebase Admin** - Server-side Firebase operations
- **CORS** - Cross-origin resource sharing

## 📦 Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Firebase account

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd gfundreach
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   
   a. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   
   b. Enable Authentication (Email/Password and Google)
   
   c. Create a Firestore database
   
   d. Enable Storage
   
   e. Get your Firebase configuration from Project Settings
   
   f. Update `src/config/firebase.js` with your config:
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_AUTH_DOMAIN",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_STORAGE_BUCKET",
     messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
     appId: "YOUR_APP_ID"
   };
   ```

4. **Configure Firestore Security Rules**
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read: if true;
         allow write: if request.auth != null && request.auth.uid == userId;
       }
       
       match /posts/{postId} {
         allow read: if true;
         allow create: if request.auth != null;
         allow update: if request.auth != null;
         allow delete: if request.auth != null && request.auth.uid == resource.data.authorId;
       }
       
       match /transactions/{transactionId} {
         allow read: if request.auth != null && 
           (request.auth.uid == resource.data.donorId || 
            request.auth.uid == resource.data.recipientId);
         allow create: if request.auth != null;
       }
     }
   }
   ```

5. **Configure Storage Rules**
   ```javascript
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /posts/{allPaths=**} {
         allow read: if true;
         allow write: if request.auth != null;
       }
     }
   }
   ```

## 🏃‍♂️ Running the Application

### Development Mode

1. **Start the frontend**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173`

2. **Start the backend server** (optional)
   ```bash
   npm run server
   ```
   The API will be available at `http://localhost:5000`

### Production Build

```bash
npm run build
npm run preview
```

## 📁 Project Structure

```
gfunreach/
├── public/                 # Static files
├── server/                 # Backend server
│   ├── index.js           # Express server
│   ├── .env.example       # Environment variables template
│   └── .gitignore         # Server gitignore
├── src/
│   ├── assets/            # Images, fonts, etc.
│   ├── components/        # Reusable components
│   │   ├── Navbar.jsx
│   │   └── ProtectedRoute.jsx
│   ├── config/            # Configuration files
│   │   └── firebase.js    # Firebase configuration
│   ├── contexts/          # React contexts
│   │   └── AuthContext.jsx
│   ├── pages/             # Page components
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   ├── Home.jsx
│   │   ├── CreatePost.jsx
│   │   ├── PostDetail.jsx
│   │   ├── Profile.jsx
│   │   └── Wallet.jsx
│   ├── App.jsx            # Main app component
│   ├── main.jsx           # Entry point
│   └── index.css          # Global styles
├── .gitignore
├── package.json
├── tailwind.config.js     # TailwindCSS configuration
├── vite.config.js         # Vite configuration
└── README.md
```

## 🔐 Environment Variables

Create a `.env` file in the root directory (for backend):

```env
PORT=5000
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY=your_private_key
```

## 📱 Features Overview

### 1. Authentication
- Email/password registration and login
- Google OAuth integration
- Protected routes
- Persistent sessions

### 2. Home Feed
- Browse all fundraising campaigns
- See campaign progress bars
- Filter by category
- Real-time updates

### 3. Create Campaign
- Upload campaign images
- Set fundraising goals
- Choose categories
- Rich text descriptions

### 4. Campaign Details
- View full campaign information
- Make donations
- See campaign progress
- Share campaigns

### 5. User Profile
- View personal campaigns
- Track donation history
- See statistics (donated, received)
- Edit profile information

### 6. Wallet
- Top up wallet balance
- View transaction history
- Track donations sent and received
- Secure fund management

## 🛠️ Future Enhancements

- [ ] Payment gateway integration (Stripe, PayPal)
- [ ] Email notifications
- [ ] Campaign comments and updates
- [ ] Social sharing features
- [ ] Campaign verification system
- [ ] Advanced search and filters
- [ ] Mobile app (React Native)
- [ ] Admin dashboard
- [ ] Analytics and reporting
- [ ] Multiple currency support

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

## 👥 Team

Built with ❤️ for connecting people in need with generous donors.

## 🙏 Acknowledgments

- Material Design 3 by Google
- Firebase by Google
- React community
- TailwindCSS team

---

For questions or support, please open an issue on GitHub.


## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
