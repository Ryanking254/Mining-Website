import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getLoans, createLoan, repayLoan, asArray } from '../lib/api';
import { formatKES, formatDate } from '../lib/format';

const empty = { borrowerName: '', amountGiven: '', dateGiven: '', notes: '' };

export default function Loans() {
  const [loans, setLoans] = useState([]);
  const [form, setForm] = useState(empty);
  const [submitting, setSubmitting] = useState(false);
  const [repayAmount, setRepayAmount] = useState({});

  const load = () => getLoans().then((res) => setLoans(asArray(res.data)));
  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createLoan({
        borrowerName: form.borrowerName,
        amountGiven: Number(form.amountGiven),
        dateGiven: form.dateGiven || new Date().toISOString().slice(0, 10),
        notes: form.notes || null,
      });
      setForm(empty);
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleRepay = async (id) => {
    const amount = Number(repayAmount[id]);
    if (!amount) return;
    await repayLoan(id, { amount });
    setRepayAmount({ ...repayAmount, [id]: '' });
    load();
  };

  return (
    <div>
      <h1 className="font-display text-2xl text-bone mb-8">Loans</h1>

      <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 mb-9 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-bonedim">Borrower</label>
          <input required value={form.borrowerName} onChange={(e) => setForm({ ...form, borrowerName: e.target.value })} className="w-40" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-bonedim">Amount (KES)</label>
          <input required type="number" step="0.01" value={form.amountGiven} onChange={(e) => setForm({ ...form, amountGiven: e.target.value })} className="w-32" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-bonedim">Date given</label>
          <input type="date" value={form.dateGiven} onChange={(e) => setForm({ ...form, dateGiven: e.target.value })} className="w-40" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-bonedim">Notes</label>
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-48" />
        </div>
        <button type="submit" disabled={submitting} className="bg-gold text-iron px-4 py-2 text-sm font-medium rounded disabled:opacity-50">
          {submitting ? 'Recording…' : 'Record loan'}
        </button>
      </form>

      <div className="ingot-head"><span>Borrower</span><span>Given · repaid</span></div>
      <AnimatePresence initial={false}>
        {loans.map((l) => {
          const pct = l.amountGiven ? Math.round((l.amountRepaid / l.amountGiven) * 100) : 0;
          return (
            <motion.div key={l.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="ingot-wrap">
              <div className="ingot">
                <div className="ingot-fill" style={{ width: `${pct}%` }} />
                <span>
                  <span className="title">{l.borrowerName}</span>
                  <span className="sub">{formatDate(l.dateGiven)}</span>
                  {l.status && (
                    <span className={`status ${l.status === 'REPAID' ? 'closed' : 'open'}`}>{l.status.toLowerCase().replace('_', ' ')}</span>
                  )}
                </span>
                <span className="meta tabular">
                  {formatKES(l.amountGiven)}<br />
                  <span className="text-verdigris">{formatKES(l.amountRepaid)} repaid</span>
                </span>
                {l.status !== 'REPAID' && (
                  <span className="flex gap-1.5 z-10 relative">
                    <input
                      type="number" step="0.01" placeholder="Amount"
                      value={repayAmount[l.id] ?? ''}
                      onChange={(e) => setRepayAmount({ ...repayAmount, [l.id]: e.target.value })}
                      className="w-20 text-xs"
                    />
                    <button onClick={() => handleRepay(l.id)} className="text-xs border border-hair rounded px-2 text-bonedim hover:text-bone hover:border-gold">Log</button>
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
      {loans.length === 0 && <p className="text-bonedim text-sm mt-4">No loans recorded yet.</p>}
    </div>
  );
}
