import axios from 'axios';

// Production backend on Render — hardcoded so Vercel works even without env vars.
// Local dev can still override via VITE_API_BASE_URL in .env.
export const HARDCODED_API_URL = 'https://mining-backend-69lu.onrender.com/api';

const rawBase = import.meta.env.VITE_API_BASE_URL || HARDCODED_API_URL;
const baseURL = String(rawBase).replace(/\/+$/, '');

if (!import.meta.env.VITE_API_BASE_URL) {
  console.info(`[api] VITE_API_BASE_URL not set — using ${HARDCODED_API_URL}`);
}

export const asArray = (data) => (Array.isArray(data) ? data : []);
export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('ledger-user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// --- Auth ---
export const loginUser = (payload) => api.post('/auth/login', payload);
export const registerUser = (payload) => api.post('/auth/register', payload);
export const getMe = () => api.get('/auth/me');

// --- Batches ---
export const getBatches = (params) => api.get('/batches', { params });
export const getBatch = (id) => api.get(`/batches/${id}`);
export const createBatch = (payload) => api.post('/batches', payload);

// --- Sales ---
export const getSales = (params) => api.get('/sales', { params });
export const createSale = (payload) => api.post('/sales', payload);
export const getSalesSummary = (params) => api.get('/sales/summary', { params });
export const exportSales = () => api.get('/sales/export', { responseType: 'blob' });

// --- Loans ---
export const getLoans = () => api.get('/loans');
export const createLoan = (payload) => api.post('/loans', payload);
export const repayLoan = (id, payload) => api.patch(`/loans/${id}/repay`, payload);

// --- Expenditures ---
export const getExpenditures = () => api.get('/expenditures');
export const createExpenditure = (payload) => api.post('/expenditures', payload);

// --- Withdrawals ---
export const getWithdrawals = () => api.get('/withdrawals');
export const createWithdrawal = (payload) => api.post('/withdrawals', payload);

// --- Capital ---
export const getCapital = () => api.get('/capital');
export const setStartingCapital = (payload) => api.put('/capital/starting', payload);
