import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SearchProvider } from './contexts/SearchContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';
import ErrorBoundary from './components/ErrorBoundary';
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
import GroupDetail from './pages/user/GroupDetail';
import EditCampaign from './pages/user/EditCampaign';
import CampaignStats from './pages/user/CampaignStats';
import AdminDashboard from './pages/admin/AdminDashboard';
import TopDonors from './pages/user/TopDonors';

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
  <SearchProvider>
  <QueryClientProvider client={queryClient}>
  <ErrorBoundary>
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
            path="/group/:id"
            element={
              <ProtectedRoute>
                <GroupDetail />
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
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/top-donors"
            element={
              <ProtectedRoute>
                <TopDonors />
              </ProtectedRoute>
            }
          />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
  </Routes>
  </ErrorBoundary>
  <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
        </QueryClientProvider>
        </SearchProvider>
      </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
