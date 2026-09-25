import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/useAuth.jsx';
import { getTwofaState } from '../lib/twofa';

export default function RequireAuth({ children }) {
  const { user, isAuthed, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[13px] text-[#8A8A8A]">Loading…</p>
      </div>
    );
  }

  if (!isAuthed) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Authenticator grace expired and still not enabled → force setup.
  // The Security page itself must stay reachable to complete it.
  if (
    location.pathname !== '/security' &&
    user && !user.twofaEnabled && getTwofaState(user).overdue
  ) {
    return <Navigate to="/security" replace />;
  }

  return children;
}
