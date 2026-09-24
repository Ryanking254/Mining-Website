import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getWithdrawals, createWithdrawal, asArray } from '../lib/api';
import { formatKES, formatDate } from '../lib/format';

const empty = { amount: '', reason: '', withdrawalDate: '' };

export default function Withdrawals() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(empty);
  const [submitting, setSubmitting] = useState(false);

  const load = () => getWithdrawals().then((res) => setItems(asArray(res.data)));
  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createWithdrawal({
        amount: Number(form.amount),
        reason: form.reason || null,
        withdrawalDate: form.withdrawalDate || new Date().toISOString().slice(0, 10),
      });
      setForm(empty);
      load();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl text-bone mb-8">Withdrawals</h1>

      <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 mb-9 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-bonedim">Amount (KES)</label>
          <input required type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-32" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-bonedim">Reason</label>
          <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="w-56" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-bonedim">Date</label>
          <input type="date" value={form.withdrawalDate} onChange={(e) => setForm({ ...form, withdrawalDate: e.target.value })} className="w-40" />
        </div>
        <button type="submit" disabled={submitting} className="bg-gold text-iron px-4 py-2 text-sm font-medium rounded disabled:opacity-50">
          {submitting ? 'Recording…' : 'Record withdrawal'}
        </button>
      </form>

      <AnimatePresence initial={false}>
        {items.map((x) => (
          <motion.div key={x.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="ingot-wrap">
            <div className="ingot">
              <span>
                <span className="title">{x.reason || 'Owner withdrawal'}</span>
                <span className="sub">{formatDate(x.withdrawalDate)}</span>
              </span>
              <span className="meta figure-negative tabular">− {formatKES(x.amount)}</span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      {items.length === 0 && <p className="text-bonedim text-sm mt-4">No withdrawals recorded yet.</p>}
    </div>
  );
}
