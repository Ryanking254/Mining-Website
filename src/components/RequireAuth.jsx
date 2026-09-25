import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/useAuth.jsx';

export default function RequireAuth({ children }) {
  const { isAuthed, loading } = useAuth();
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

  return children;
}
