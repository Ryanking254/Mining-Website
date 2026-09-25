import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  PieChart, Pie,
} from 'recharts';
import {
  getCapital, getSalesSummary, getSales,
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
  const [recentSales, setRecentSales] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loans, setLoans] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');

  const dateWindowValid = from && to && from <= to;

  // Static ledger data — loaded once.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load needs a loading flag
    setLoading(true);
    Promise.all([
      getCapital().catch(() => ({ data: null })),
      getSales().catch(() => ({ data: [] })),
      getBatches().catch(() => ({ data: [] })),
      getLoans().catch(() => ({ data: [] })),
      getExpenditures().catch(() => ({ data: [] })),
    ])
      .then(([cap, sales, bat, loan, exp]) => {
        setCapital(cap.data);
        setRecentSales(asArray(sales.data).slice(0, 5));
        setBatches(asArray(bat.data).slice(0, 3));
        setLoans(asArray(loan.data).filter((l) => l.status !== 'REPAID').slice(0, 3));
        setExpenses(asArray(exp.data));
      })
      .finally(() => setLoading(false));
  }, []);

  // Sales Overview chart — refetches whenever the calendar window changes.
  useEffect(() => {
    if (!dateWindowValid) {
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
    return [];
  }, [salesSummary]);

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

      {/* Middle row */}
      <div className="grid lg:grid-cols-3 gap-3 mb-3">
        <div className="card p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-bold">Sales Overview</h2>
            <div className="flex gap-1 text-[11px]">
              {ranges.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-2 py-0.5 rounded ${range === r ? 'bg-black text-white' : 'text-[#8A8A8A] hover:text-black'}`}
                >
                  {r === 'daily' ? '1M' : r === 'weekly' ? '3M' : '6M'}
                </button>
              ))}
            </div>
          </div>
          <div className="h-56">
            {barData.length === 0 ? (
              <p className="text-[13px] text-[#8A8A8A] py-6 text-center">No sales data yet — record a sale to see the chart.</p>
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
            {recentSales.map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-2.5 border-b border-[#F1EDE2] last:border-0">
                <span className="w-9 h-9 rounded-xl bg-[#F6F1E8] flex items-center justify-center text-[#E8620C] shrink-0"><SalesIcon className="w-[18px] h-[18px]" /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-semibold truncate">{s.batchNumber ?? 'Sale'} · {formatGrams(s.gramsSold)}</span>
                  <span className="block text-[12px] text-[#8A8A8A]">{formatDate(s.saleDate)}</span>
                </span>
                <span className="text-right">
                  <span className="block text-[13px] font-bold tabular">{formatKES(s.totalSellingPrice)}</span>
                  <span className={`block text-[12px] tabular font-medium ${(s.profitLoss ?? 0) >= 0 ? 'text-[#1F9D55]' : 'text-[#E5484D]'}`}>
                    {(s.profitLoss ?? 0) >= 0 ? '+' : ''}{formatKES(s.profitLoss)}
                  </span>
                </span>
              </div>
            ))}
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
