import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getExpenditures, createExpenditure, asArray } from '../lib/api';
import { formatKES, formatDate } from '../lib/format';

const empty = { amount: '', category: '', description: '', expenseDate: '' };

export default function Expenditures() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(empty);
  const [submitting, setSubmitting] = useState(false);

  const load = () => getExpenditures().then((res) => setItems(asArray(res.data)));
  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createExpenditure({
        amount: Number(form.amount),
        category: form.category,
        description: form.description || null,
        expenseDate: form.expenseDate || new Date().toISOString().slice(0, 10),
      });
      setForm(empty);
      load();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl text-bone mb-8">Expenditures</h1>

      <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 mb-9 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-bonedim">Amount (KES)</label>
          <input required type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-32" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-bonedim">Category</label>
          <input required placeholder="transport, rent…" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-36" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-bonedim">Description</label>
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-56" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-bonedim">Date</label>
          <input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} className="w-40" />
        </div>
        <button type="submit" disabled={submitting} className="bg-gold text-iron px-4 py-2 text-sm font-medium rounded disabled:opacity-50">
          {submitting ? 'Recording…' : 'Record expense'}
        </button>
      </form>

      <AnimatePresence initial={false}>
        {items.map((x) => (
          <motion.div key={x.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="ingot-wrap">
            <div className="ingot">
              <span>
                <span className="title">{x.category}</span>
                <span className="sub">{x.description ? `${x.description} · ` : ''}{formatDate(x.expenseDate)}</span>
              </span>
              <span className="meta figure-negative tabular">− {formatKES(x.amount)}</span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      {items.length === 0 && <p className="text-bonedim text-sm mt-4">No expenditures recorded yet.</p>}
    </div>
  );
}
