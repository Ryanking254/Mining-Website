import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import { getExpenditures, createExpenditure, asArray } from '../lib/api';
import { formatKES, formatDate } from '../lib/format';
import { ExpendituresIcon } from '../components/icons.jsx';

const empty = { amount: '', category: '', description: '', expenseDate: '' };

export default function Expenditures() {
  const { query = '' } = useOutletContext() ?? {};
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(empty);
  const [submitting, setSubmitting] = useState(false);

  const load = () => getExpenditures().then((res) => setItems(asArray(res.data))).catch(() => {});
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return items;
    return items.filter((x) => `${x.category} ${x.description}`.toLowerCase().includes(q));
  }, [items, query]);

  const total = items.reduce((a, x) => a + (Number(x.amount) || 0), 0);

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
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Expenditures</h1>
          <p className="text-[13px] text-[#8A8A8A]">{items.length} records · {formatKES(total)} total</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card p-4 mb-3">
        <p className="text-[13px] font-bold mb-3">Record expense</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C]">Amount (KES)
            <input required type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C]">Category
            <input required placeholder="transport, rent…" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C] lg:col-span-1">Description
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C]">Date
            <input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} />
          </label>
          <button type="submit" disabled={submitting} className="bg-black text-white px-4 py-2.5 text-[13px] font-semibold rounded-[10px] disabled:opacity-50 h-[42px]">
            {submitting ? 'Recording…' : '+ Record expense'}
          </button>
        </div>
      </form>

      <div className="card p-4">
        <h2 className="text-[14px] font-bold mb-2">All expenditures</h2>
        <AnimatePresence initial={false}>
          {filtered.map((x) => (
            <motion.div key={x.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-3 py-3 border-b border-[#F1EDE2] last:border-0">
              <span className="w-10 h-10 rounded-xl bg-[#FDECEC] text-[#E5484D] flex items-center justify-center shrink-0"><ExpendituresIcon className="w-5 h-5" /></span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-semibold truncate">{x.category}</span>
                <span className="block text-[12px] text-[#8A8A8A] truncate">{x.description ? `${x.description} · ` : ''}{formatDate(x.expenseDate)}</span>
              </span>
              <span className="text-[13px] font-bold tabular text-[#E5484D] shrink-0">− {formatKES(x.amount)}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        {filtered.length === 0 && <p className="text-[13px] text-[#8A8A8A] py-8 text-center">No expenditures recorded yet.</p>}
      </div>
    </div>
  );
}
