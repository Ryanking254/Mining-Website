import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL;

if (!baseURL) {
  console.warn('[api] VITE_API_BASE_URL is not set — copy .env.example to .env and set it.');
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
