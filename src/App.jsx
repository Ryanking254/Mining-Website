import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Batches from './pages/Batches.jsx';
import Sales from './pages/Sales.jsx';
import Loans from './pages/Loans.jsx';
import Expenditures from './pages/Expenditures.jsx';
import Withdrawals from './pages/Withdrawals.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="batches" element={<Batches />} />
        <Route path="sales" element={<Sales />} />
        <Route path="loans" element={<Loans />} />
        <Route path="expenditures" element={<Expenditures />} />
        <Route path="withdrawals" element={<Withdrawals />} />
      </Route>
    </Routes>
  );
}
