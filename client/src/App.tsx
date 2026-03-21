import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout, { StandardLayout } from './components/AppLayout';
import AuthPage from './pages/AuthPage';
import KolonPage from './pages/KolonPage';
import SystemCouponPage from './pages/SystemCouponPage';
import MyCouponsPage from './pages/MyCouponsPage';
import LivePage from './pages/LivePage';
import SearchPage from './pages/SearchPage';
import StandingsPage from './pages/StandingsPage';
import TeamValuesPage from './pages/TeamValuesPage';
import TeamDetailPage from './pages/TeamDetailPage';
import PlayerPage from './pages/PlayerPage';
import TournamentsPage from './pages/TournamentsPage';
import HistoryPage from './pages/HistoryPage';
import AdminDashboard from './pages/AdminDashboard';
import ProfilePage from './pages/ProfilePage';
import ForumPage from './pages/ForumPage';
import TopicDetailPage from './pages/TopicDetailPage';
import PhoneVerificationModal from './components/PhoneVerificationModal';

function PhoneVerificationGuard() {
  const { user, isLoading } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed when user changes (new login)
  useEffect(() => {
    setDismissed(false);
  }, [user?.id]);

  if (isLoading || !user || dismissed) return null;
  if (user.phoneVerified) return null;

  // Check if user already dismissed this session
  const key = `pvm_dismissed_${user.id}`;
  if (sessionStorage.getItem(key)) return null;

  function handleClose() {
    sessionStorage.setItem(`pvm_dismissed_${user!.id}`, '1');
    setDismissed(true);
  }

  return <PhoneVerificationModal onClose={handleClose} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PhoneVerificationGuard />
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<AuthPage />} />
          <Route element={<AppLayout />}>
            <Route element={<StandardLayout />}>
              <Route path="/forum" element={<ForumPage />} />
              <Route path="/forum/:id" element={<TopicDetailPage />} />
            </Route>
          </Route>

          {/* Protected routes under AppLayout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<KolonPage />} />
              <Route element={<StandardLayout />}>
                <Route path="/sistem" element={<SystemCouponPage />} />
                <Route path="/kuponlarim" element={<MyCouponsPage />} />
                <Route path="/live" element={<LivePage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/standings" element={<StandingsPage />} />
                <Route path="/values" element={<TeamValuesPage />} />
                <Route path="/team-detail" element={<TeamDetailPage />} />
                <Route path="/player" element={<PlayerPage />} />
                <Route path="/tournaments" element={<TournamentsPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/admin" element={<AdminDashboard />} />
              </Route>
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
