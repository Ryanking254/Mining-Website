import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getBatches, createBatch, asArray } from '../lib/api';
import { formatKES, formatGrams, formatDate } from '../lib/format';

const empty = { itemName: '', gramsBought: '', pricePerGram: '', purchaseDate: '' };

export default function Batches() {
  const [batches, setBatches] = useState([]);
  const [form, setForm] = useState(empty);
  const [submitting, setSubmitting] = useState(false);

  const load = () => getBatches().then((res) => setBatches(asArray(res.data)));
  useEffect(() => {
    load();
  }, []);

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

  return (
    <div>
      <h1 className="font-display text-2xl text-bone mb-8">Batches</h1>

      <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 mb-9 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-bonedim">Item</label>
          <input required value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} placeholder="e.g. Raw silver" className="w-40" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-bonedim">Grams bought</label>
          <input required type="number" step="0.01" value={form.gramsBought} onChange={(e) => setForm({ ...form, gramsBought: e.target.value })} className="w-32" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-bonedim">Price / gram (KES)</label>
          <input required type="number" step="0.01" value={form.pricePerGram} onChange={(e) => setForm({ ...form, pricePerGram: e.target.value })} className="w-32" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-bonedim">Purchase date</label>
          <input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} className="w-40" />
        </div>
        <button type="submit" disabled={submitting} className="bg-gold text-iron px-4 py-2 text-sm font-medium rounded disabled:opacity-50">
          {submitting ? 'Recording…' : 'Record batch'}
        </button>
      </form>

      <div className="ingot-head"><span>Batch</span><span>Bought · remaining · cost/g</span></div>
      <AnimatePresence initial={false}>
        {batches.map((b) => {
          const pct = b.gramsBought ? Math.round(((b.gramsBought - b.gramsRemaining) / b.gramsBought) * 100) : 0;
          return (
            <motion.div key={b.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="ingot-wrap">
              <div className="ingot">
                <div className="ingot-fill" style={{ width: `${pct}%` }} />
                <span>
                  <span className="title">{b.itemName}</span>
                  <span className="sub">{b.batchNumber} · {formatDate(b.purchaseDate)}</span>
                  <span className={`status ${b.status === 'OPEN' ? 'open' : 'closed'}`}>{b.status?.toLowerCase()}</span>
                </span>
                <span className="meta tabular">{formatGrams(b.gramsBought)} · {formatGrams(b.gramsRemaining)} left<br />{formatKES(b.pricePerGram)}/g</span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
      {batches.length === 0 && <p className="text-bonedim text-sm mt-4">No batches recorded yet — add the first one above.</p>}
    </div>
  );
}
