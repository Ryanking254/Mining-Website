import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import { getSales, createSale, getBatches, exportSales, asArray } from '../lib/api';
import { formatKES, formatGrams, formatDate } from '../lib/format';
import { SalesIcon } from '../components/icons.jsx';

const empty = { batchId: '', gramsSold: '', sellingPricePerGram: '', saleDate: '' };

export default function Sales() {
  const { query = '' } = useOutletContext() ?? {};
  const [sales, setSales] = useState([]);
  const [openBatches, setOpenBatches] = useState([]);
  const [form, setForm] = useState(empty);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = () => {
    getSales().then((res) => setSales(asArray(res.data))).catch(() => {});
    getBatches({ status: 'OPEN' }).then((res) => setOpenBatches(asArray(res.data))).catch(() => {});
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return sales;
    return sales.filter((s) => `${s.batchNumber} ${s.batchId}`.toLowerCase().includes(q));
  }, [sales, query]);

  const totalRevenue = sales.reduce((a, s) => a + (Number(s.totalSellingPrice) || 0), 0);
  const totalProfit = sales.reduce((a, s) => a + (Number(s.profitLoss) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createSale({
        batchId: form.batchId,
        gramsSold: Number(form.gramsSold),
        sellingPricePerGram: Number(form.sellingPricePerGram),
        saleDate: form.saleDate || new Date().toISOString().slice(0, 10),
      });
      setForm(empty);
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await exportSales();
      const url = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'sales.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Sales</h1>
          <p className="text-[13px] text-[#8A8A8A]">{formatKES(totalRevenue)} revenue · <span className={totalProfit >= 0 ? 'text-[#1F9D55]' : 'text-[#E5484D]'}>{formatKES(totalProfit)} profit</span></p>
        </div>
        <button onClick={handleExport} disabled={exporting} className="text-[13px] font-semibold border border-[#E3DCCB] rounded-full px-4 py-2 bg-white hover:border-black disabled:opacity-50">
          {exporting ? 'Preparing…' : 'Export .xlsx'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="card p-4 mb-3">
        <p className="text-[13px] font-bold mb-3">Record sale</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C] lg:col-span-1">Batch
            <select required value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })}>
              <option value="">Select a batch</option>
              {openBatches.map((b) => (
                <option key={b.id} value={b.id}>{b.batchNumber} — {b.itemName} ({formatGrams(b.gramsRemaining)} left)</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C]">Grams sold
            <input required type="number" step="0.01" value={form.gramsSold} onChange={(e) => setForm({ ...form, gramsSold: e.target.value })} placeholder="0.00" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C]">Price / g (KES)
            <input required type="number" step="0.01" value={form.sellingPricePerGram} onChange={(e) => setForm({ ...form, sellingPricePerGram: e.target.value })} placeholder="0.00" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C]">Sale date
            <input type="date" value={form.saleDate} onChange={(e) => setForm({ ...form, saleDate: e.target.value })} />
          </label>
          <button type="submit" disabled={submitting} className="bg-black text-white px-4 py-2.5 text-[13px] font-semibold rounded-[10px] disabled:opacity-50 h-[42px]">
            {submitting ? 'Recording…' : '+ Record sale'}
          </button>
        </div>
      </form>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[14px] font-bold">All sales</h2>
          <span className="text-[12px] text-[#8A8A8A]">Grams · total · P/L</span>
        </div>
        <AnimatePresence initial={false}>
          {filtered.map((s) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-3 py-3 border-b border-[#F1EDE2] last:border-0">
              <span className="w-10 h-10 rounded-xl bg-[#FFF0E3] text-[#E8620C] flex items-center justify-center shrink-0"><SalesIcon className="w-5 h-5" /></span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-semibold truncate">{s.batchNumber ?? s.batchId}</span>
                <span className="block text-[12px] text-[#8A8A8A]">{formatDate(s.saleDate)} · {formatGrams(s.gramsSold)}</span>
              </span>
              <span className="text-right shrink-0">
                <span className="block text-[13px] font-bold tabular">{formatKES(s.totalSellingPrice)}</span>
                <span className={`inline-block mt-0.5 badge ${(s.profitLoss ?? 0) >= 0 ? 'badge-green' : 'badge-red'} tabular`}>
                  {(s.profitLoss ?? 0) >= 0 ? '+' : ''}{formatKES(s.profitLoss)}
                </span>
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
        {filtered.length === 0 && <p className="text-[13px] text-[#8A8A8A] py-8 text-center">No sales recorded yet.</p>}
      </div>
    </div>
  );
}
