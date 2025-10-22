import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SearchProvider } from './contexts/SearchContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/user/Login';
import Register from './pages/user/Register';
import Home from './pages/user/Home';
import CreatePost from './pages/user/CreatePost';
import PostDetail from './pages/user/PostDetail';
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
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
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
                <CreatePost />
              </ProtectedRoute>
            }
          />
          <Route
            path="/post/:id"
            element={
              <ProtectedRoute>
                <PostDetail />
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
