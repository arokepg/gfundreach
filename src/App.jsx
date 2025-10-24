import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SearchProvider } from './contexts/SearchContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Welcome from './pages/user/Welcome';
import Login from './pages/user/Login';
import Register from './pages/user/Register';
import ForgotPassword from './pages/user/ForgotPassword';
import Home from './pages/user/Home';
import CreateCampaign from './pages/user/CreateCampaign';
import CampaignDetail from './pages/user/CampaignDetail';
import CommunityPostDetail from './pages/user/CommunityPostDetail';
import Profile from './pages/user/Profile';
import EditProfile from './pages/user/EditProfile';
import Wallet from './pages/user/Wallet';
import Explore from './pages/user/Explore';
import Saved from './pages/user/Saved';
import Group from './pages/user/Group';
import EditCampaign from './pages/user/EditCampaign';
import CampaignStats from './pages/user/CampaignStats';
import AdminBackfill from './pages/admin/AdminBackfill';

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
        <SearchProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          
          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/explore"
            element={
              <ProtectedRoute>
                <Explore />
              </ProtectedRoute>
            }
          />
          <Route
            path="/saved"
            element={
              <ProtectedRoute>
                <Saved />
              </ProtectedRoute>
            }
          />
          <Route
            path="/group"
            element={
              <ProtectedRoute>
                <Group />
              </ProtectedRoute>
            }
          />
          <Route
            path="/groups"
            element={
              <ProtectedRoute>
                <Group />
              </ProtectedRoute>
            }
          />
          <Route
            path="/create-post"
            element={
              <ProtectedRoute>
                <CreateCampaign />
              </ProtectedRoute>
            }
          />
          <Route
            path="/post/:id"
            element={
              <ProtectedRoute>
                <CampaignDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/community-post/:campaignId/:postId"
            element={
              <ProtectedRoute>
                <CommunityPostDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/:userId"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/edit-profile"
            element={
              <ProtectedRoute>
                <EditProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/wallet"
            element={
              <ProtectedRoute>
                <Wallet />
              </ProtectedRoute>
            }
          />
          <Route
            path="/edit-campaign/:id"
            element={
              <ProtectedRoute>
                <EditCampaign />
              </ProtectedRoute>
            }
          />
          <Route
            path="/campaign-stats/:id"
            element={
              <ProtectedRoute>
                <CampaignStats />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/backfill"
            element={
              <ProtectedRoute>
                <AdminBackfill />
              </ProtectedRoute>
            }
          />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        </SearchProvider>
      </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
