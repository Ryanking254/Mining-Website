import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getSales, createSale, getBatches, exportSales, asArray } from '../lib/api';
import { formatKES, formatGrams, formatDate } from '../lib/format';

const empty = { batchId: '', gramsSold: '', sellingPricePerGram: '', saleDate: '' };

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [openBatches, setOpenBatches] = useState([]);
  const [form, setForm] = useState(empty);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = () => {
    getSales().then((res) => setSales(asArray(res.data)));
    getBatches({ status: 'OPEN' }).then((res) => setOpenBatches(asArray(res.data)));
  };
  useEffect(load, []);

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
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-2xl text-bone">Sales</h1>
        <button onClick={handleExport} disabled={exporting} className="text-xs border border-hair rounded px-3 py-1.5 text-bonedim hover:text-bone hover:border-gold transition-colors duration-150">
          {exporting ? 'Preparing…' : 'Export .xlsx'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 mb-9 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-bonedim">Batch</label>
          <select required value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })} className="w-48">
            <option value="">Select a batch</option>
            {openBatches.map((b) => (
              <option key={b.id} value={b.id}>{b.batchNumber} — {b.itemName} ({formatGrams(b.gramsRemaining)} left)</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-bonedim">Grams sold</label>
          <input required type="number" step="0.01" value={form.gramsSold} onChange={(e) => setForm({ ...form, gramsSold: e.target.value })} className="w-28" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-bonedim">Selling price / g (KES)</label>
          <input required type="number" step="0.01" value={form.sellingPricePerGram} onChange={(e) => setForm({ ...form, sellingPricePerGram: e.target.value })} className="w-32" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-bonedim">Sale date</label>
          <input type="date" value={form.saleDate} onChange={(e) => setForm({ ...form, saleDate: e.target.value })} className="w-40" />
        </div>
        <button type="submit" disabled={submitting} className="bg-gold text-iron px-4 py-2 text-sm font-medium rounded disabled:opacity-50">
          {submitting ? 'Recording…' : 'Record sale'}
        </button>
      </form>

      <div className="ingot-head"><span>Sale</span><span>Grams · total · P/L</span></div>
      <AnimatePresence initial={false}>
        {sales.map((s) => (
          <motion.div key={s.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="ingot-wrap">
            <div className="ingot">
              <span>
                <span className="title">{s.batchNumber ?? s.batchId}</span>
                <span className="sub">{formatDate(s.saleDate)}</span>
              </span>
              <span className="meta tabular">
                {formatGrams(s.gramsSold)} · {formatKES(s.totalSellingPrice)}<br />
                <span className={s.profitLoss >= 0 ? 'figure-positive' : 'figure-negative'}>
                  {s.profitLoss >= 0 ? '+' : ''}{formatKES(s.profitLoss)}
                </span>
              </span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      {sales.length === 0 && <p className="text-bonedim text-sm mt-4">No sales recorded yet.</p>}
    </div>
  );
}
