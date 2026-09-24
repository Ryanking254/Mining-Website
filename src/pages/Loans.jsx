import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import { getLoans, createLoan, repayLoan, asArray } from '../lib/api';
import { formatKES, formatDate } from '../lib/format';

const empty = { borrowerName: '', amountGiven: '', dateGiven: '', notes: '' };

export default function Loans() {
  const { query = '' } = useOutletContext() ?? {};
  const [loans, setLoans] = useState([]);
  const [form, setForm] = useState(empty);
  const [submitting, setSubmitting] = useState(false);
  const [repayAmount, setRepayAmount] = useState({});

  const load = () => getLoans().then((res) => setLoans(asArray(res.data))).catch(() => {});
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return loans;
    return loans.filter((l) => `${l.borrowerName} ${l.status}`.toLowerCase().includes(q));
  }, [loans, query]);

  const outstanding = loans.reduce((a, l) => a + ((Number(l.amountGiven) || 0) - (Number(l.amountRepaid) || 0)), 0);

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
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Loans</h1>
          <p className="text-[13px] text-[#8A8A8A]">{loans.filter((l) => l.status !== 'REPAID').length} open · {formatKES(outstanding)} outstanding</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card p-4 mb-3">
        <p className="text-[13px] font-bold mb-3">Record loan</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C]">Borrower
            <input required value={form.borrowerName} onChange={(e) => setForm({ ...form, borrowerName: e.target.value })} placeholder="Full name" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C]">Amount (KES)
            <input required type="number" step="0.01" value={form.amountGiven} onChange={(e) => setForm({ ...form, amountGiven: e.target.value })} placeholder="0.00" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C]">Date given
            <input type="date" value={form.dateGiven} onChange={(e) => setForm({ ...form, dateGiven: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C]">Notes
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
          </label>
          <button type="submit" disabled={submitting} className="bg-black text-white px-4 py-2.5 text-[13px] font-semibold rounded-[10px] disabled:opacity-50 h-[42px]">
            {submitting ? 'Recording…' : '+ Record loan'}
          </button>
        </div>
      </form>

      <div className="card p-4">
        <h2 className="text-[14px] font-bold mb-2">All loans</h2>
        <AnimatePresence initial={false}>
          {filtered.map((l) => {
            const pct = l.amountGiven ? Math.round((Number(l.amountRepaid) / Number(l.amountGiven)) * 100) : 0;
            return (
              <motion.div key={l.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="py-3 border-b border-[#F1EDE2] last:border-0">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-full bg-[#F6F1E8] flex items-center justify-center text-[13px] font-bold shrink-0">
                    {(l.borrowerName || '?').slice(0, 1).toUpperCase()}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold truncate">{l.borrowerName}</span>
                      {l.status && <span className={`badge ${l.status === 'REPAID' ? 'badge-gray' : 'badge-orange'}`}>{l.status.toLowerCase().replace('_', ' ')}</span>}
                    </span>
                    <span className="block text-[12px] text-[#8A8A8A]">{formatDate(l.dateGiven)}{l.notes ? ` · ${l.notes}` : ''}</span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block text-[13px] font-bold tabular">{formatKES(l.amountGiven)}</span>
                    <span className="block text-[12px] text-[#1F9D55] tabular">{formatKES(l.amountRepaid)} repaid</span>
                  </span>
                </div>
                <div className="mt-2 ml-[52px]">
                  <div className="progress mb-2"><div style={{ width: `${pct}%`, background: '#1A1A1A' }} /></div>
                  {l.status !== 'REPAID' && (
                    <div className="flex gap-2">
                      <input
                        type="number" step="0.01" placeholder="Repay amount"
                        value={repayAmount[l.id] ?? ''}
                        onChange={(e) => setRepayAmount({ ...repayAmount, [l.id]: e.target.value })}
                        className="max-w-[180px]! text-[13px]! py-1.5!"
                      />
                      <button onClick={() => handleRepay(l.id)} className="text-[13px] font-semibold bg-[#FFF0E3] text-[#E8620C] rounded-[10px] px-4 hover:bg-[#E8620C] hover:text-white">Log</button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {filtered.length === 0 && <p className="text-[13px] text-[#8A8A8A] py-8 text-center">No loans recorded yet.</p>}
      </div>
    </div>
  );
}
