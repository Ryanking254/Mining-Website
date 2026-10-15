import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import { getLoans, createLoan, repayLoan, topupLoan, asArray } from '../lib/api';
import { formatKES, formatDate } from '../lib/format';

const empty = { borrowerName: '', amountGiven: '', dateGiven: '', notes: '' };

// Grouping key: case- and spacing-insensitive so "John Doe", "john doe"
// and "  John   Doe " all count as the same person.
const borrowerKey = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');

export default function Loans() {
  const { query = '' } = useOutletContext() ?? {};
  const [loans, setLoans] = useState([]);
  const [form, setForm] = useState(empty);
  const [submitting, setSubmitting] = useState(false);
  const [repayAmount, setRepayAmount] = useState({});
  const [topupAmount, setTopupAmount] = useState({});
  const [topupError, setTopupError] = useState({});
  // Borrowers directory tab: one expandable card per person with their full
  // loan history + a quick "lend again" box (no retyping their details).
  const [tab, setTab] = useState('loans'); // 'loans' | 'borrowers'
  const [openBorrower, setOpenBorrower] = useState(null);
  const [relendAmount, setRelendAmount] = useState({});
  const [relendBusy, setRelendBusy] = useState({});
  const [relendError, setRelendError] = useState({});

  const load = () => getLoans().then((res) => setLoans(asArray(res.data))).catch(() => {});
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return loans;
    return loans.filter((l) => `${l.borrowerName} ${l.status}`.toLowerCase().includes(q));
  }, [loans, query]);

  const outstanding = loans.reduce((a, l) => a + ((Number(l.amountGiven) || 0) - (Number(l.amountRepaid) || 0)), 0);

  // Per-person directory built from all loans (no backend change needed).
  const borrowers = useMemo(() => {
    const map = new Map();
    for (const l of loans) {
      const key = borrowerKey(l.borrowerName);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(l);
    }
    const list = [...map.entries()].map(([key, items]) => {
      const sorted = [...items].sort(
        (a, b) => String(b.dateGiven || '').localeCompare(String(a.dateGiven || '')) || b.id - a.id
      );
      const totalGiven = sorted.reduce((a, l) => a + (Number(l.amountGiven) || 0), 0);
      const totalRepaid = sorted.reduce((a, l) => a + (Number(l.amountRepaid) || 0), 0);
      return {
        key,
        // Most recent casing of the name, so the directory looks tidy.
        name: sorted[0].borrowerName,
        loans: sorted,
        count: sorted.length,
        totalGiven,
        totalRepaid,
        outstanding: totalGiven - totalRepaid,
        open: sorted.filter((l) => l.status !== 'REPAID').length,
        lastDate: sorted[0].dateGiven,
      };
    });
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [loans]);

  const filteredBorrowers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return borrowers;
    return borrowers.filter((b) => b.name.toLowerCase().includes(q));
  }, [borrowers, query]);

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

  // Lend extra on top of a pending loan (borrower takes another amount
  // while the previous balance is still outstanding).
  const handleTopup = async (id) => {
    const amount = Number(topupAmount[id]);
    if (!amount || amount <= 0) {
      setTopupError({ ...topupError, [id]: 'Enter an amount above 0.' });
      return;
    }
    setTopupError({ ...topupError, [id]: '' });
    try {
      await topupLoan(id, { amount });
      setTopupAmount({ ...topupAmount, [id]: '' });
      load();
    } catch (err) {
      setTopupError({ ...topupError, [id]: err?.response?.data?.error || 'Could not add top-up. Try again.' });
    }
  };

  // Lend again to a known borrower: creates a fresh loan row reusing the
  // recorded name — no retyping their details.
  const handleRelend = async (key, name) => {
    const amount = Number(relendAmount[key]);
    if (!amount || amount <= 0) {
      setRelendError({ ...relendError, [key]: 'Enter an amount above 0.' });
      return;
    }
    setRelendError({ ...relendError, [key]: '' });
    setRelendBusy({ ...relendBusy, [key]: true });
    try {
      await createLoan({
        borrowerName: name,
        amountGiven: amount,
        dateGiven: new Date().toISOString().slice(0, 10),
        notes: null,
      });
      setRelendAmount({ ...relendAmount, [key]: '' });
      load();
    } catch (err) {
      setRelendError({ ...relendError, [key]: err?.response?.data?.error || 'Could not record loan. Try again.' });
    } finally {
      setRelendBusy({ ...relendBusy, [key]: false });
    }
  };

  // Prefill the main Record loan form with a known borrower's name.
  const prefillBorrowerInForm = (name) => {
    setForm((f) => ({ ...f, borrowerName: name }));
    setTab('loans');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Loans</h1>
          <p className="text-[13px] text-[#8A8A8A]">{loans.filter((l) => l.status !== 'REPAID').length} open · {formatKES(outstanding)} outstanding · {borrowers.length} {borrowers.length === 1 ? 'borrower' : 'borrowers'}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card p-4 mb-3">
        <p className="text-[13px] font-bold mb-3">Record loan</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C]">Borrower
            <input
              required
              value={form.borrowerName}
              onChange={(e) => setForm({ ...form, borrowerName: e.target.value })}
              placeholder="Full name"
              list="borrower-suggestions"
              autoComplete="off"
            />
            <datalist id="borrower-suggestions">
              {borrowers.map((b) => (
                <option key={b.key} value={b.name} />
              ))}
            </datalist>
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

      <div className="flex gap-2 mb-3">
        {[
          { key: 'loans', label: `All loans (${filtered.length})` },
          { key: 'borrowers', label: `Borrowers (${filteredBorrowers.length})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-[13px] font-semibold px-4 py-2 rounded-full ${tab === t.key ? 'bg-black text-white' : 'border border-[#E3DCCB] bg-white hover:border-black'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'loans' ? (
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
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <input
                          type="number" step="0.01" placeholder="Repay amount"
                          value={repayAmount[l.id] ?? ''}
                          onChange={(e) => setRepayAmount({ ...repayAmount, [l.id]: e.target.value })}
                          className="max-w-[180px]! text-[13px]! py-1.5!"
                        />
                        <button onClick={() => handleRepay(l.id)} className="text-[13px] font-semibold bg-[#FFF0E3] text-[#E8620C] rounded-[10px] px-4 hover:bg-[#E8620C] hover:text-white">Log</button>
                      </div>
                      <div className="flex gap-2 items-center">
                        <input
                          type="number" step="0.01" min="0" placeholder="Top-up amount"
                          value={topupAmount[l.id] ?? ''}
                          onChange={(e) => setTopupAmount({ ...topupAmount, [l.id]: e.target.value })}
                          className="max-w-[180px]! text-[13px]! py-1.5!"
                        />
                        <button onClick={() => handleTopup(l.id)} className="text-[13px] font-semibold bg-black text-white rounded-[10px] px-4 py-1.5 hover:bg-[#333]">+ Top up</button>
                      </div>
                      {topupError[l.id] && (
                        <p className="text-[12px] font-medium text-[#E5484D]">{topupError[l.id]}</p>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {filtered.length === 0 && <p className="text-[13px] text-[#8A8A8A] py-8 text-center">No loans recorded yet.</p>}
      </div>
      ) : (
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[14px] font-bold">Borrowers</h2>
          <span className="text-[12px] text-[#8A8A8A]">Tap a person for full history + lend again</span>
        </div>
        <AnimatePresence initial={false}>
          {filteredBorrowers.map((b) => {
            const open = openBorrower === b.key;
            return (
              <motion.div key={b.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="py-3 border-b border-[#F1EDE2] last:border-0">
                <button onClick={() => setOpenBorrower(open ? null : b.key)} className="flex items-center gap-3 w-full text-left">
                  <span className="w-10 h-10 rounded-full bg-[#F6F1E8] flex items-center justify-center text-[13px] font-bold shrink-0">
                    {(b.name || '?').slice(0, 1).toUpperCase()}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold truncate">{b.name}</span>
                      {b.open > 0
                        ? <span className="badge badge-orange">{b.open} open</span>
                        : <span className="badge badge-gray">fully repaid</span>}
                      {b.count > 1 && <span className="text-[11px] text-[#8A8A8A]">{b.count} loans</span>}
                    </span>
                    <span className="block text-[12px] text-[#8A8A8A]">
                      borrowed {formatKES(b.totalGiven)} · repaid {formatKES(b.totalRepaid)} · last {formatDate(b.lastDate)}
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className={`block text-[13px] font-bold tabular ${b.outstanding > 0 ? '' : 'text-[#1F9D55]'}`}>
                      {b.outstanding > 0 ? `${formatKES(b.outstanding)} due` : 'cleared'}
                    </span>
                    <span className="block text-[12px] text-[#8A8A8A]">{open ? '▴' : '▾'}</span>
                  </span>
                </button>
                {open && (
                  <div className="mt-2 ml-[52px]">
                    <div className="flex gap-2 items-center rounded-[10px] bg-[#FAF7F0] border border-[#E3DCCB] px-3 py-2.5">
                      <input
                        type="number" step="0.01" min="0" placeholder="New loan amount"
                        value={relendAmount[b.key] ?? ''}
                        onChange={(e) => setRelendAmount({ ...relendAmount, [b.key]: e.target.value })}
                        className="max-w-[180px]! text-[13px]! py-1.5!"
                      />
                      <button
                        onClick={() => handleRelend(b.key, b.name)}
                        disabled={relendBusy[b.key]}
                        className="text-[13px] font-semibold bg-black text-white rounded-[10px] px-4 py-1.5 hover:bg-[#333] disabled:opacity-50 whitespace-nowrap"
                      >
                        {relendBusy[b.key] ? 'Saving…' : '+ Lend again'}
                      </button>
                      <button
                        onClick={() => prefillBorrowerInForm(b.name)}
                        className="text-[12px] font-semibold text-[#8A8A8A] hover:text-black underline underline-offset-2 whitespace-nowrap"
                      >
                        Use in form
                      </button>
                    </div>
                    {relendError[b.key] && (
                      <p className="text-[12px] font-medium text-[#E5484D] mt-1">{relendError[b.key]}</p>
                    )}
                    <div className="mt-2">
                      {b.loans.map((l) => (
                        <div key={l.id} className="flex items-center justify-between gap-3 py-2 border-b border-[#F1EDE2] last:border-0">
                          <span className="text-[12px] text-[#5C5C5C]">
                            {formatDate(l.dateGiven)}{l.notes ? ` · ${l.notes}` : ''}
                          </span>
                          <span className="flex items-center gap-2 shrink-0">
                            <span className="text-[12px] tabular">
                              <span className="font-bold">{formatKES(l.amountGiven)}</span>
                              <span className="text-[#1F9D55]"> · {formatKES(l.amountRepaid)} repaid</span>
                            </span>
                            {l.status && <span className={`badge ${l.status === 'REPAID' ? 'badge-gray' : 'badge-orange'}`}>{l.status.toLowerCase()}</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        {filteredBorrowers.length === 0 && (
          <p className="text-[13px] text-[#8A8A8A] py-8 text-center">
            {borrowers.length === 0 ? 'No borrowers yet — record the first loan above.' : 'No borrower matches your search.'}
          </p>
        )}
      </div>
      )}
    </div>
  );
}
