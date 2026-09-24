import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import { getBatches, createBatch, asArray } from '../lib/api';
import { formatKES, formatGrams, formatDate } from '../lib/format';
import { BatchesIcon } from '../components/icons.jsx';

const empty = { itemName: '', gramsBought: '', pricePerGram: '', purchaseDate: '' };

export default function Batches() {
  const { query = '' } = useOutletContext() ?? {};
  const [batches, setBatches] = useState([]);
  const [form, setForm] = useState(empty);
  const [submitting, setSubmitting] = useState(false);

  const load = () => getBatches().then((res) => setBatches(asArray(res.data))).catch(() => {});
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return batches;
    return batches.filter((b) => `${b.itemName} ${b.batchNumber}`.toLowerCase().includes(q));
  }, [batches, query]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createBatch({
        itemName: form.itemName,
        gramsBought: Number(form.gramsBought),
        pricePerGram: Number(form.pricePerGram),
        purchaseDate: form.purchaseDate || new Date().toISOString().slice(0, 10),
      });
      setForm(empty);
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const totalStock = batches.reduce((a, b) => a + (Number(b.gramsRemaining) || 0), 0);

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Batches</h1>
          <p className="text-[13px] text-[#8A8A8A]">{batches.length} batches · {formatGrams(totalStock)} in stock</p>
        </div>
        <span className="badge badge-orange">{filtered.length} shown</span>
      </div>

      <form onSubmit={handleSubmit} className="card p-4 mb-3">
        <p className="text-[13px] font-bold mb-3">Record batch</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C]">Item
            <input required value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} placeholder="e.g. Raw gold" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C]">Grams bought
            <input required type="number" step="0.01" value={form.gramsBought} onChange={(e) => setForm({ ...form, gramsBought: e.target.value })} placeholder="0.00" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C]">Price / gram (KES)
            <input required type="number" step="0.01" value={form.pricePerGram} onChange={(e) => setForm({ ...form, pricePerGram: e.target.value })} placeholder="0.00" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C]">Purchase date
            <input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
          </label>
          <button type="submit" disabled={submitting} className="bg-black text-white px-4 py-2.5 text-[13px] font-semibold rounded-[10px] disabled:opacity-50 h-[42px]">
            {submitting ? 'Recording…' : '+ Record batch'}
          </button>
        </div>
      </form>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[14px] font-bold">All batches</h2>
          <span className="text-[12px] text-[#8A8A8A]">Bought · remaining · cost/g</span>
        </div>
        <AnimatePresence initial={false}>
          {filtered.map((b) => {
            const pctLeft = b.gramsBought ? Math.round((Number(b.gramsRemaining) / Number(b.gramsBought)) * 100) : 0;
            return (
              <motion.div key={b.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-3 py-3 border-b border-[#F1EDE2] last:border-0">
                <span className="w-10 h-10 rounded-xl bg-[#F6F1E8] text-[#5C5C5C] flex items-center justify-center shrink-0"><BatchesIcon className="w-5 h-5" /></span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold truncate">{b.itemName}</span>
                    <span className={`badge ${b.status === 'OPEN' ? 'badge-green' : 'badge-gray'}`}>{b.status?.toLowerCase()}</span>
                  </span>
                  <span className="block text-[12px] text-[#8A8A8A]">{b.batchNumber} · {formatDate(b.purchaseDate)}</span>
                  <span className="block mt-1.5 max-w-[280px]"><span className="progress"><div style={{ width: `${pctLeft}%` }} /></span></span>
                </span>
                <span className="text-right shrink-0">
                  <span className="block text-[13px] font-bold tabular">{formatGrams(b.gramsBought)} · {formatGrams(b.gramsRemaining)}</span>
                  <span className="block text-[12px] text-[#8A8A8A] tabular">{formatKES(b.pricePerGram)}/g</span>
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {filtered.length === 0 && <p className="text-[13px] text-[#8A8A8A] py-8 text-center">No batches found — add the first one above.</p>}
      </div>
    </div>
  );
}
