import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import RequireAdmin from './components/RequireAdmin.jsx';
import RequireNonAdmin from './components/RequireNonAdmin.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Batches from './pages/Batches.jsx';
import Sales from './pages/Sales.jsx';
import Loans from './pages/Loans.jsx';
import Expenditures from './pages/Expenditures.jsx';
import Withdrawals from './pages/Withdrawals.jsx';
import Security from './pages/Security.jsx';
import Admin from './pages/Admin.jsx';
import Login from './pages/Login.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login initialMode="login" />} />
      <Route path="/register" element={<Login initialMode="register" />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<RequireNonAdmin><Dashboard /></RequireNonAdmin>} />
        <Route path="batches" element={<RequireNonAdmin><Batches /></RequireNonAdmin>} />
        <Route path="sales" element={<RequireNonAdmin><Sales /></RequireNonAdmin>} />
        <Route path="loans" element={<RequireNonAdmin><Loans /></RequireNonAdmin>} />
        <Route path="expenditures" element={<RequireNonAdmin><Expenditures /></RequireNonAdmin>} />
        <Route path="withdrawals" element={<RequireNonAdmin><Withdrawals /></RequireNonAdmin>} />
        {/* Security stays reachable for admins (authenticator setup) but is
            hidden from the admin sidebar — ledger pages above always bounce
            admins back to /admin. */}
        <Route path="security" element={<Security />} />
        <Route
          path="admin"
          element={
            <RequireAdmin>
              <Admin />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
