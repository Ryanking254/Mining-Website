import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  PieChart, Pie,
} from 'recharts';
import {
  getCapital, getCapitalAdditions, setStartingCapital, addCapital,
  getSalesSummary, getSales,
  getBatches, getLoans, getExpenditures, asArray,
} from '../lib/api';
import { formatKES, formatGrams, formatDate } from '../lib/format';
import { SalesIcon } from '../components/icons.jsx';

const toISO = (d) => d.toISOString().slice(0, 10);
const monthsAgoISO = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return toISO(d);
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseISODate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').slice(0, 10));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

// ISO-8601 week number (Monday-first) for the weekly chart bucket.
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const fday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fday + 3);
  return 1 + Math.round((t.getTime() - firstThursday.getTime()) / (7 * 86400000));
}

function mondayKey(d) {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (t.getDay() + 6) % 7;
  t.setDate(t.getDate() - day);
  return toISO(t);
}

// Local fallback grouping for the Sales Overview chart — same buckets as the
// backend summary, so bars render even when /sales/summary returns nothing.
function groupSalesLocally(salesList, bucket, from, to) {
  const groups = new Map();
  for (const s of salesList) {
    const iso = String(s.saleDate || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso < from || iso > to) continue;
    const d = parseISODate(iso);
    if (!d) continue;
    let key;
    let label;
    if (bucket === 'daily') {
      key = iso;
      label = `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`;
    } else if (bucket === 'weekly') {
      key = mondayKey(d);
      label = `W${isoWeek(d)}`;
    } else {
      key = iso.slice(0, 7);
      label = MONTHS[d.getMonth()];
    }
    const g = groups.get(key) ?? { name: label, revenue: 0, profit: 0 };
    g.revenue += Number(s.totalSellingPrice) || 0;
    g.profit += Number(s.profitLoss) || 0;
    groups.set(key, g);
  }
  return [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, g]) => g);
}

function Kpi({ label, value }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-semibold tracking-wide text-[#8A8A8A]">{label}</p>
      </div>
      <p className="text-[22px] font-bold tracking-tight tabular">{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const [capital, setCapital] = useState(null);
  const [bucket, setBucket] = useState('monthly');
  const [from, setFrom] = useState(() => monthsAgoISO(6));
  const [to, setTo] = useState(() => toISO(new Date()));
  const [salesSummary, setSalesSummary] = useState([]);
  const [allSales, setAllSales] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loans, setLoans] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');

  // Capital manager — starting capital + manual top-ups for this account.
  const [additions, setAdditions] = useState([]);
  const [capFormOpen, setCapFormOpen] = useState(false);
  const [capMode, setCapMode] = useState('add'); // 'add' | 'starting'
  const [capAmount, setCapAmount] = useState('');
  const [capNote, setCapNote] = useState('');
  const [capBusy, setCapBusy] = useState(false);
  const [capError, setCapError] = useState('');

  const refreshCapital = async () => {
    try {
      const [capRes, addRes] = await Promise.all([
        getCapital(),
        getCapitalAdditions().catch(() => ({ data: [] })),
      ]);
      setCapital(capRes.data);
      setAdditions(asArray(addRes.data));
    } catch {
      /* ignore */
    }
  };

  const dateWindowValid = from && to && from <= to;

  // One-time fit: if the earliest sale predates the default 6-month window,
  // widen the start date so the chart includes it on first load.
  const fittedWindow = useRef(false);

  // Static ledger data — loaded once.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load needs a loading flag
    setLoading(true);
    Promise.all([
      getCapital().catch(() => ({ data: null })),
      getCapitalAdditions().catch(() => ({ data: [] })),
      getSales().catch(() => ({ data: [] })),
      getBatches().catch(() => ({ data: [] })),
      getLoans().catch(() => ({ data: [] })),
      getExpenditures().catch(() => ({ data: [] })),
    ])
      .then(([cap, addRes, sales, bat, loan, exp]) => {
        setCapital(cap.data);
        setAdditions(asArray(addRes.data));
        const all = asArray(sales.data);
        setAllSales(all);
        setRecentSales(all.slice(0, 5));
        if (!fittedWindow.current && all.length > 0) {
          fittedWindow.current = true;
          const earliest = all
            .map((s) => String(s.saleDate || '').slice(0, 10))
            .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
            .sort()[0];
          if (earliest && earliest < monthsAgoISO(6)) {
            setFrom(earliest);
          }
        }
        setBatches(asArray(bat.data).slice(0, 3));
        setLoans(asArray(loan.data).filter((l) => l.status !== 'REPAID').slice(0, 3));
        setExpenses(asArray(exp.data));
      })
      .finally(() => setLoading(false));
  }, []);

  // Sales Overview chart — refetches whenever the calendar window changes.
  useEffect(() => {
    if (!dateWindowValid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- invalid window clears the chart
      setSalesSummary([]);
      setSummaryError(from && to && from > to ? 'Start date must be on or before end date.' : '');
      return;
    }
    setSummaryError('');
    let cancelled = false;
    getSalesSummary({ from, to, bucket })
      .then((res) => {
        if (!cancelled) setSalesSummary(asArray(res.data));
      })
      .catch(() => {
        if (!cancelled) setSalesSummary([]);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, bucket, dateWindowValid]);

  const total = capital?.currentCapital ?? capital?.total ?? 0;
  const breakdown = capital?.breakdown ?? {};
  const salesRevenue = breakdown.sales ?? salesSummary.reduce((a, s) => a + (Number(s.revenue) || 0), 0);
  const expenditures = breakdown.expenditures ?? expenses.reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const outstandingLoans = loans.reduce((a, l) => a + ((Number(l.amountGiven) || 0) - (Number(l.amountRepaid) || 0)), 0);

  const today = new Date().toLocaleDateString('en-KE', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const barData = useMemo(() => {
    if (salesSummary.length > 0) {
      return salesSummary.map((s) => ({
        name: s.period ?? s.label ?? '',
        revenue: Number(s.revenue) || 0,
        profit: Number(s.profit) || 0,
      }));
    }
    // Fallback: the summary endpoint came back empty (out-of-window dates,
    // a failed request, …) but sales exist — group them locally so the
    // chart still reflects the selected window instead of showing nothing.
    if (dateWindowValid && allSales.length > 0) {
      return groupSalesLocally(allSales, bucket, from, to);
    }
    return [];
  }, [salesSummary, allSales, bucket, from, to, dateWindowValid]);

  const maxIdx = barData.reduce((mi, d, i) => (d.revenue > (barData[mi]?.revenue || 0) ? i : mi), 0);

  const expByCat = useMemo(() => {
    const map = {};
    expenses.forEach((e) => {
      const k = e.category || 'Other';
      map[k] = (map[k] || 0) + (Number(e.amount) || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).slice(0, 4);
  }, [expenses]);

  const expTotal = expByCat.reduce((a, c) => a + c.value, 0);
  const donutColors = ['#E8620C', '#1A1A1A', '#C9A227', '#D8D2C2'];

  const startingCapital = capital?.startingCapital ?? breakdown.starting ?? 0;
  const manualAdded = capital?.manualAdditions ?? capital?.addedCapital ?? breakdown.added ?? 0;

  const handleCapitalSubmit = async (e) => {
    e.preventDefault();
    setCapError('');
    const amount = Number(capAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setCapError('Enter a positive amount.');
      return;
    }
    setCapBusy(true);
    try {
      if (capMode === 'starting') {
        await setStartingCapital({ amount });
      } else {
        await addCapital({ amount, note: capNote.trim() || undefined });
      }
      setCapAmount('');
      setCapNote('');
      setCapFormOpen(false);
      await refreshCapital();
    } catch (err) {
      setCapError(err?.response?.data?.error || 'Could not update capital. Try again.');
    } finally {
      setCapBusy(false);
    }
  };

  return (
    <div>
      {/* Header like screenshot */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Overview</h1>
          <p className="text-[13px] text-[#8A8A8A]">{today}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/batches" className="text-[13px] font-semibold px-4 py-2 rounded-full border border-[#E3DCCB] bg-white hover:border-black">+ Batch</Link>
          <Link to="/sales" className="text-[13px] font-semibold px-4 py-2 rounded-full bg-black text-white hover:bg-[#333]">+ Add Transaction</Link>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-3">
        <Kpi label="TOTAL CAPITAL" value={formatKES(total)} />
        <Kpi label="SALES REVENUE" value={formatKES(salesRevenue)} />
        <Kpi label="EXPENDITURES" value={formatKES(expenditures)} />
        <Kpi label="LOANS OUT" value={formatKES(outstandingLoans)} />
      </div>

      {/* Capital manager — starting capital + manual top-ups (per account) */}
      <div className="card p-4 mb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-[14px] font-bold">Capital</h2>
            <p className="text-[12px] text-[#8A8A8A] tabular">
              Started {formatKES(startingCapital)}
              {manualAdded > 0 && <> · topped up {formatKES(manualAdded)}</>} · now {formatKES(total)}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setCapMode('add'); setCapFormOpen((v) => !(v && capMode === 'add')); setCapError(''); }}
              className="text-[13px] font-semibold px-4 py-2 rounded-full bg-black text-white hover:bg-[#333]"
            >
              + Add funds
            </button>
            <button
              onClick={() => { setCapMode('starting'); setCapFormOpen((v) => !(v && capMode === 'starting')); setCapError(''); setCapAmount(String(startingCapital || '')); }}
              className="text-[13px] font-semibold px-4 py-2 rounded-full border border-[#E3DCCB] bg-white hover:border-black"
            >
              Set starting
            </button>
          </div>
        </div>
        {capFormOpen && (
          <form onSubmit={handleCapitalSubmit} className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-end">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C] flex-1">
              {capMode === 'starting' ? 'Starting capital (KES)' : 'Amount to add (KES)'}
              <input
                required
                type="number" min="0" step="0.01"
                value={capAmount}
                onChange={(e) => setCapAmount(e.target.value)}
                placeholder="0.00"
              />
            </label>
            {capMode === 'add' && (
              <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C] flex-1">
                Note (optional)
                <input
                  value={capNote}
                  onChange={(e) => setCapNote(e.target.value)}
                  placeholder="e.g. Extra cash injected"
                  maxLength={255}
                />
              </label>
            )}
            <button
              type="submit" disabled={capBusy}
              className="bg-black text-white px-4 py-2.5 text-[13px] font-semibold rounded-[10px] disabled:opacity-50 h-[42px] whitespace-nowrap"
            >
              {capBusy ? 'Saving…' : capMode === 'starting' ? 'Save starting' : '+ Add to capital'}
            </button>
          </form>
        )}
        {capError && (
          <p className="text-[13px] font-medium text-[#E5484D] bg-[#FDECEC] rounded-[10px] px-3 py-2 mt-3">{capError}</p>
        )}
        {additions.length > 0 && (
          <div className="mt-3 border-t border-[#F1EDE2] pt-2">
            <p className="text-[11px] font-semibold tracking-wide text-[#8A8A8A] mb-1">TOP-UPS</p>
            {additions.slice(0, 3).map((a) => (
              <div key={a.id} className="flex items-center justify-between text-[13px] py-1">
                <span className="text-[#5C5C5C] truncate">{a.note || 'Manual top-up'} · {formatDate(a.createdAt)}</span>
                <span className="font-semibold tabular text-[#1F9D55]">+{formatKES(a.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Middle row */}
      <div className="grid lg:grid-cols-3 gap-3 mb-3">
        <div className="card p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-[14px] font-bold">Sales Overview</h2>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                className="border border-[#E3DCCB] rounded-[8px] px-1.5 py-1 text-[11px] text-[#5C5C5C] bg-white"
                aria-label="From date"
              />
              <span className="text-[#8A8A8A]">–</span>
              <input
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
                className="border border-[#E3DCCB] rounded-[8px] px-1.5 py-1 text-[11px] text-[#5C5C5C] bg-white"
                aria-label="To date"
              />
              {['daily', 'weekly', 'monthly'].map((b) => (
                <button
                  key={b}
                  onClick={() => setBucket(b)}
                  className={`px-2 py-1 rounded ${bucket === b ? 'bg-black text-white' : 'text-[#8A8A8A] hover:text-black'}`}
                >
                  {b === 'daily' ? 'Daily' : b === 'weekly' ? 'Weekly' : 'Monthly'}
                </button>
              ))}
            </div>
          </div>
          {summaryError && (
            <p className="text-[12px] font-medium text-[#E5484D] mb-2">{summaryError}</p>
          )}
          <div className="h-56">
            {barData.length === 0 ? (
              <p className="text-[13px] text-[#8A8A8A] py-6 text-center">
                {allSales.length > 0
                  ? 'No sales in this date range — widen the dates above to see them.'
                  : 'No sales data yet — record a sale to see the chart.'}
              </p>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} barCategoryGap="28%">
                <CartesianGrid stroke="#F1EDE2" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8A8A8A' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8A8A8A' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={36} />
                <Tooltip
                  contentStyle={{ background: '#1A1A1A', border: 'none', borderRadius: 10, color: '#fff', fontSize: 12 }}
                  formatter={(v) => formatKES(v)}
                />
                <Bar dataKey="revenue" radius={[6, 6, 2, 2]}>
                  {barData.map((_, i) => (
                    <Cell key={i} fill={i === maxIdx ? '#E8620C' : '#E3DCCB'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            )}
          </div>
          {loading && <p className="text-xs text-[#8A8A8A] mt-2">Loading…</p>}
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[14px] font-bold">Top Categories</h2>
          </div>
          {expByCat.length === 0 ? (
            <p className="text-[13px] text-[#8A8A8A] py-6 text-center">No expenses yet.</p>
          ) : (
          <>
          <div className="h-44 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={expByCat} dataKey="value" nameKey="name" innerRadius={52} outerRadius={72} paddingAngle={3} strokeWidth={0}>
                  {expByCat.map((_, i) => (
                    <Cell key={i} fill={donutColors[i % donutColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatKES(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-[15px] font-bold tabular">{formatKES(expTotal)}</p>
              <p className="text-[11px] text-[#8A8A8A]">Spent</p>
            </div>
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            {expByCat.map((c, i) => (
              <div key={c.name} className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: donutColors[i % donutColors.length] }} />
                  {c.name}
                </span>
                <span className="font-semibold tabular">{formatKES(c.value)}</span>
              </div>
            ))}
          </div>
          </>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid lg:grid-cols-2 gap-3">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-bold">Recent Sales</h2>
            <Link to="/sales" className="text-[12px] text-[#8A8A8A] hover:text-black">View All</Link>
          </div>
          <div className="flex flex-col">
            {recentSales.length === 0 && (
              <p className="text-[13px] text-[#8A8A8A] py-6 text-center">No sales yet — <Link to="/sales" className="text-[#E8620C] font-semibold">record the first sale</Link>.</p>
            )}
            {recentSales.map((s) => {
              const pct = Number(s.purityPercentage ?? s.percentage ?? 100) || 100;
              const showPct = Math.abs(pct - 100) > 0.005;
              return (
              <div key={s.id} className="flex items-center gap-3 py-2.5 border-b border-[#F1EDE2] last:border-0">
                <span className="w-9 h-9 rounded-xl bg-[#F6F1E8] flex items-center justify-center text-[#E8620C] shrink-0"><SalesIcon className="w-[18px] h-[18px]" /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-semibold truncate">{s.batchNumber ?? 'Sale'} · {formatGrams(s.gramsSold)}{showPct && ` · ${pct}%`}</span>
                  <span className="block text-[12px] text-[#8A8A8A]">{formatDate(s.saleDate)}</span>
                </span>
                <span className="text-right">
                  <span className="block text-[13px] font-bold tabular">{formatKES(s.totalSellingPrice)}</span>
                  <span className={`block text-[12px] tabular font-medium ${(s.profitLoss ?? 0) >= 0 ? 'text-[#1F9D55]' : 'text-[#E5484D]'}`}>
                    {(s.profitLoss ?? 0) >= 0 ? '+' : ''}{formatKES(s.profitLoss)}
                  </span>
                </span>
              </div>
              );
            })}
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-bold">Stock & Recovery</h2>
            <Link to="/batches" className="text-[12px] text-[#8A8A8A] hover:text-black">All Batches</Link>
          </div>
          <div className="flex flex-col gap-4">
            {batches.map((b) => {
              const pctLeft = b.gramsBought ? Math.round((Number(b.gramsRemaining) / Number(b.gramsBought)) * 100) : 0;
              return (
                <div key={b.id}>
                  <div className="flex justify-between text-[13px] mb-1.5">
                    <span className="font-semibold">{b.itemName} <span className="font-normal text-[#8A8A8A]">· {formatGrams(b.gramsRemaining)} left</span></span>
                    <span className="text-[#8A8A8A] text-xs">{pctLeft}% left</span>
                  </div>
                  <div className="progress"><div style={{ width: `${pctLeft}%` }} /></div>
                </div>
              );
            })}
            {loans.map((l) => {
              const pct = l.amountGiven ? Math.round((Number(l.amountRepaid) / Number(l.amountGiven)) * 100) : 0;
              return (
                <div key={l.id}>
                  <div className="flex justify-between text-[13px] mb-1.5">
                    <span className="font-semibold">{l.borrowerName} <span className="font-normal text-[#8A8A8A]">· {formatKES(l.amountRepaid)} repaid</span></span>
                    <span className="text-[#8A8A8A] text-xs">{pct}% repaid</span>
                  </div>
                  <div className="progress"><div style={{ width: `${pct}%`, background: '#1A1A1A' }} /></div>
                </div>
              );
            })}
            {batches.length === 0 && loans.length === 0 && (
              <p className="text-[13px] text-[#8A8A8A] py-6 text-center">No batches or loans yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
