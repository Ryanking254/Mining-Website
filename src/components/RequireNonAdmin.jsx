import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/useAuth.jsx';

// Opposite of RequireAdmin: regular users only.
// Admins are locked to /admin — any attempt to open a ledger page
// (dashboard, batches, sales, loans, expenditures, withdrawals)
// bounces them back to the admin console.
export default function RequireNonAdmin({ children }) {
  const { user, isAuthed, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[13px] text-[#8A8A8A]">Loading…</p>
      </div>
    );
  }

  if (!isAuthed) {
    return <Navigate to="/login" replace />;
  }

  if (user?.isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}
