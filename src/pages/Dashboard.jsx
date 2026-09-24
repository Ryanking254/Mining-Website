import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { getCapital, getSalesSummary, asArray } from '../lib/api';
import { formatKES } from '../lib/format';
import AnimatedFigure from '../components/AnimatedFigure';
import TiltPanel from '../components/TiltPanel';

const BREAKDOWN_LABELS = {
  startingCapital: 'Starting',
  purchases: 'Purchases',
  loansGiven: 'Loans given',
  withdrawals: 'Withdrawals',
  expenditures: 'Expenditures',
  sales: 'Sales revenue',
};

export default function Dashboard() {
  const [capital, setCapital] = useState(null);
  const [range, setRange] = useState('monthly');
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getCapital(), getSalesSummary({ range })])
      .then(([capitalRes, salesRes]) => {
        setCapital(capitalRes.data);
        setSales(asArray(salesRes.data));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [range]);

  const total = capital?.currentCapital ?? capital?.total ?? 0;
  const breakdown = capital?.breakdown ?? {};

  return (
    <div>
      <div className="hero">
        {/* Watermark: a faint balance scale behind the medallion — the
            one signature graphic, used exactly once. */}
        <svg className="watermark" viewBox="0 0 200 200" fill="none">
          <path
            d="M100 15v160M40 45h120M25 45l-25 50h50l-25-50zM175 45l-25 50h50l-25-50zM25 95c0 16 12 24 25 24s25-8 25-24M150 95c0 16 12 24 25 24s25-8 25-24M55 175h90"
            stroke="#E7C34F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>

        <TiltPanel>
          <div className="medallion">
            <small>Current capital</small>
            <AnimatedFigure value={total} formatter={formatKES} className="figure tabular" />
          </div>
        </TiltPanel>

        <div className="thread" />
        <div className="tag">
          {Object.entries(BREAKDOWN_LABELS).map(([key, label]) => {
            const val = breakdown[key];
            if (val === undefined) return null;
            const isDeduction = ['purchases', 'loansGiven', 'withdrawals', 'expenditures'].includes(key);
            return (
              <div key={key} className="b-row tabular">
                <span className="lbl">{label}</span>
                <span className={isDeduction ? 'figure-negative' : 'figure-positive'}>
                  {isDeduction ? '−' : '+'} {formatKES(val)}
                </span>
              </div>
            );
          })}
          {loading && <p className="text-bonedim text-xs mt-1">Loading…</p>}
          {!loading && Object.keys(breakdown).length === 0 && (
            <p className="text-bonedim text-xs mt-1">No breakdown yet from the API.</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg text-bone">Sales &amp; profit</h2>
        <div className="flex gap-1 text-xs">
          {['daily', 'weekly', 'monthly'].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2.5 py-1 rounded-full border ${
                range === r ? 'border-gold text-gold' : 'border-hair text-bonedim hover:text-bone'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64 -ml-4">
        {sales.length === 0 ? (
          <p className="text-bonedim text-sm ml-4">No sales recorded for this period yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sales}>
              <CartesianGrid stroke="rgba(237,230,214,0.06)" vertical={false} />
              <XAxis dataKey="period" stroke="#948C79" fontSize={12} tickLine={false} axisLine={{ stroke: 'rgba(237,230,214,0.09)' }} />
              <YAxis stroke="#948C79" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip contentStyle={{ background: '#1C1811', border: '1px solid rgba(237,230,214,0.14)' }} labelStyle={{ color: '#EDE6D6' }} formatter={(v) => formatKES(v)} />
              <Line type="monotone" dataKey="revenue" stroke="#E7C34F" strokeWidth={2} dot={false} name="Revenue" />
              <Line type="monotone" dataKey="profit" stroke="#6E8C74" strokeWidth={2} dot={false} name="Profit" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
