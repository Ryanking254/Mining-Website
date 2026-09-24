const kes = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 0,
});

export const formatKES = (value) => kes.format(Number(value) || 0);

export const formatGrams = (value) => `${Number(value).toLocaleString()} g`;

export const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
