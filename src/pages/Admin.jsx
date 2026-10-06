import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  getAdminUsers,
  setUserSuspension,
  getAdminOverview,
  getAdminUserSummary,
  getAdminUserCapital,
  getAdminUserBatches,
  getAdminUserSales,
  getAdminUserLoans,
  getAdminUserExpenditures,
  getAdminUserWithdrawals,
  setUser2faExempt,
  asArray,
} from '../lib/api';
import { formatDate, formatGrams, formatKES } from '../lib/format';
import { useAuth } from '../lib/useAuth.jsx';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'batches', label: 'Batches' },
  { key: 'sales', label: 'Sales' },
  { key: 'loans', label: 'Loans' },
  { key: 'expenditures', label: 'Expenses' },
  { key: 'withdrawals', label: 'Withdrawals' },
  { key: 'capital', label: 'Capital' },
];

function Stat({ label, value, accent }) {
  return (
    <div className="card p-3">
      <p className="text-[11px] font-semibold tracking-wide text-[#8A8A8A]">{label}</p>
      <p className={`text-[17px] font-bold tracking-tight tabular mt-1 ${accent || ''}`}>{value}</p>
    </div>
  );
}

export default function Admin() {
  const { user: me } = useAuth();
  const outlet = useOutletContext() || {};
  const globalQuery = typeof outlet.query === 'string' ? outlet.query : '';
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reasons, setReasons] = useState({}); // userId -> reason text
  const [busyId, setBusyId] = useState(null);
  const [rowError, setRowError] = useState({}); // userId -> error

  // Platform totals across all accounts.
  const [overview, setOverview] = useState(null);

  // Pending authenticator requests come from the Layout outlet context
  // (fetched once per navigation for the nav badge) — full management
  // lives on the Requests page.
  const pending2fa = useMemo(
    () => outlet.pending2fa || { count: 0, userIds: [] },
    [outlet.pending2fa]
  );
  const pendingCount = Number(pending2fa.count) || 0;
  const pendingUserIds = useMemo(
    () => new Set((pending2fa.userIds || []).map((n) => Number(n))),
    [pending2fa]
  );
  const [busyExemptId, setBusyExemptId] = useState(null);

  // Tracking: which account is being inspected.
  const [localSearch, setLocalSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState('overview');
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [tabRows, setTabRows] = useState([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [tabError, setTabError] = useState('');
  const [capitalDetail, setCapitalDetail] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [{ data: userList }, overviewRes] = await Promise.all([
        getAdminUsers(),
        getAdminOverview().catch(() => ({ data: null })),
      ]);
      const list = Array.isArray(userList) ? userList : [];
      setUsers(list);
      if (overviewRes?.data) setOverview(overviewRes.data);
      setReasons((prev) => {
        const next = { ...prev };
        for (const u of list) {
          if (!(u.id in next)) next[u.id] = u.suspensionReason || '';
        }
        return next;
      });
      // Auto-select the first non-admin account so tracking shows data immediately.
      if (selectedId == null) {
        const first = list.find((u) => !u.isAdmin) || list[0];
        if (first) setSelectedId(first.id);
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRevokeExempt = async (u) => {
    setRowError((p) => ({ ...p, [u.id]: '' }));
    setBusyExemptId(u.id);
    try {
      const { data } = await setUser2faExempt(u.id, false);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? data : x)));
    } catch (err) {
      setRowError((p) => ({
        ...p,
        [u.id]: err?.response?.data?.error || 'Could not update. Try again.',
      }));
    } finally {
      setBusyExemptId(null);
    }
  };

  const search = (localSearch || globalQuery || '').trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!search) return users;
    return users.filter((u) =>
      `${u.name || ''} ${u.email || ''}`.toLowerCase().includes(search)
    );
  }, [users, search]);

  const selectedUser = useMemo(
    () => users.find((u) => Number(u.id) === Number(selectedId)) || null,
    [users, selectedId]
  );

  // Per-account summary for the tracked user.
  useEffect(() => {
    if (!selectedId) {
      setSummary(null);
      return;
    }
    let cancelled = false;
    setSummaryLoading(true);
    setSummaryError('');
    getAdminUserSummary(selectedId)
      .then(({ data }) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err) => {
        if (!cancelled) setSummaryError(err?.response?.data?.error || 'Could not load summary.');
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // Per-tab ledger rows for the tracked user.
  useEffect(() => {
    if (!selectedId || tab === 'overview') {
      setTabRows([]);
      setTabError('');
      return;
    }
    let cancelled = false;
    setTabLoading(true);
    setTabError('');
    const fetcher =
      tab === 'batches' ? getAdminUserBatches
      : tab === 'sales' ? getAdminUserSales
      : tab === 'loans' ? getAdminUserLoans
      : tab === 'expenditures' ? getAdminUserExpenditures
      : tab === 'withdrawals' ? getAdminUserWithdrawals
      : tab === 'capital' ? getAdminUserCapital
      : null;
    if (!fetcher) return undefined;
    fetcher(selectedId)
      .then(({ data }) => {
        if (cancelled) return;
        if (tab === 'capital') {
          setCapitalDetail(data);
          setTabRows(asArray(data?.additions));
        } else {
          setTabRows(asArray(data));
        }
      })
      .catch((err) => {
        if (!cancelled) setTabError(err?.response?.data?.error || 'Could not load data.');
      })
      .finally(() => {
        if (!cancelled) setTabLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, tab]);

  const handleToggle = async (u) => {
    const targetSuspended = !u.isSuspended;
    const reason = (reasons[u.id] || '').trim();
    setRowError((p) => ({ ...p, [u.id]: '' }));
    if (targetSuspended && !reason) {
      setRowError((p) => ({ ...p, [u.id]: 'Give a reason — the user will see it.' }));
      return;
    }
    setBusyId(u.id);
    try {
      const { data } = await setUserSuspension(u.id, {
        suspended: targetSuspended,
        reason: targetSuspended ? reason : undefined,
      });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? data : x)));
      if (!targetSuspended) {
        setReasons((p) => ({ ...p, [u.id]: '' }));
      }
    } catch (err) {
      setRowError((p) => ({
        ...p,
        [u.id]: err?.response?.data?.error || 'Could not update. Try again.',
      }));
    } finally {
      setBusyId(null);
    }
  };

  const counts = summary?.counts || {};
  const nonAdmin = users.filter((u) => !u.isAdmin);

  return (
    <div>
      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Admin</h1>
          <p className="text-[13px] text-[#8A8A8A]">
            {users.length} account{users.length === 1 ? '' : 's'} · you only see this page ·
            select an account below to track their data
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-[13px] font-semibold px-4 py-2 rounded-full border border-[#E3DCCB] bg-white hover:border-black disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <p className="text-[13px] font-medium text-[#E5484D] bg-[#FDECEC] rounded-[10px] px-3 py-2 mb-3">{error}</p>
      )}

      {/* Platform totals */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <Stat label="ACCOUNTS" value={`${overview.regularUsers ?? nonAdmin.length} users`} />
          <Stat
            label="STATUS"
            value={`${overview.activeUsers ?? ''} active · ${overview.suspendedUsers ?? 0} paused`}
          />
          <Stat label="TOTAL REVENUE" value={formatKES(overview.totalRevenue)} />
          <Stat
            label="TOTAL PROFIT"
            value={`${(overview.totalProfit ?? 0) >= 0 ? '+' : ''}${formatKES(overview.totalProfit)}`}
            accent={(overview.totalProfit ?? 0) >= 0 ? 'text-[#1F9D55]' : 'text-[#E5484D]'}
          />
          <Stat label="STOCK BOUGHT" value={formatKES(overview.totalPurchaseCost)} />
          <Stat label="EXPENDITURES" value={formatKES(overview.totalExpenditures)} />
          <Stat label="WITHDRAWALS" value={formatKES(overview.totalWithdrawals)} />
          <Stat label="LOANS OUT" value={formatKES(overview.loansOutstanding)} />
        </div>
      )}

      {/* Pending authenticator requests — managed on the Requests page. */}
      {pendingCount > 0 && (
        <Link
          to="/requests"
          className="card p-4 mb-3 flex items-center gap-3 hover:border-black"
        >
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#FFFAEB] border border-[#FEDF89] text-[#5C4B00] shrink-0">
            {pendingCount} PENDING
          </span>
          <span className="text-[13px]">
            <span className="font-bold">Authenticator request{pendingCount === 1 ? '' : 's'} waiting.</span>{' '}
            <span className="text-[#8A8A8A]">Review on the Requests page →</span>
          </span>
        </Link>
      )}

      {/* Tracking picker */}
      <div className="card p-4 mb-3" id="track-user-data">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h2 className="text-[14px] font-bold">
            Track user data
            {selectedUser && (
              <span className="font-normal text-[#8A8A8A]">
                {' '}· {selectedUser.name || selectedUser.email}
              </span>
            )}
          </h2>
          <input
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Filter accounts by name or email…"
            className="border border-[#E3DCCB] rounded-[10px] px-3 py-2 text-[13px] min-w-[220px]"
          />
        </div>
        {loading && users.length === 0 ? (
          <p className="text-[13px] text-[#8A8A8A] py-4 text-center">Loading users…</p>
        ) : filtered.length === 0 ? (
          <p className="text-[13px] text-[#8A8A8A] py-4 text-center">No accounts match.</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filtered.map((u) => {
              const active = Number(u.id) === Number(selectedId);
              return (
                <button
                  key={u.id}
                  onClick={() => {
                    setSelectedId(u.id);
                    setTab('overview');
                  }}
                  className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-full border text-[13px] font-semibold ${
                    active ? 'bg-black text-white border-black' : 'bg-white border-[#E3DCCB] hover:border-black'
                  }`}
                  title={u.email}
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold ${active ? 'bg-white/20' : 'bg-[#F6F1E8]'}`}>
                    {(u.name || u.email || 'U').slice(0, 1).toUpperCase()}
                  </span>
                  {u.name || u.email}
                  {u.isAdmin && <span className="text-[10px] font-bold opacity-70">ADMIN</span>}
                  {u.isSuspended && <span className="text-[10px] font-bold text-[#E5484D]">PAUSED</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Tracked account detail */}
        {selectedUser && (
          <div className="mt-3 border-t border-[#F1EDE2] pt-3">
            <div className="flex gap-1.5 flex-wrap mb-3">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-semibold ${
                    tab === t.key ? 'bg-black text-white' : 'text-[#8A8A8A] hover:text-black'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'overview' && (
              <div>
                {summaryLoading ? (
                  <p className="text-[13px] text-[#8A8A8A] py-4 text-center">Loading summary…</p>
                ) : summaryError ? (
                  <p className="text-[13px] font-medium text-[#E5484D] bg-[#FDECEC] rounded-[10px] px-3 py-2">{summaryError}</p>
                ) : summary ? (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Stat label="CAPITAL NOW" value={formatKES(summary.currentCapital)} />
                    <Stat label="SALES REVENUE" value={formatKES(summary.salesRevenue)} />
                    <Stat
                      label="PROFIT"
                      value={`${(summary.salesProfit ?? 0) >= 0 ? '+' : ''}${formatKES(summary.salesProfit)}`}
                      accent={(summary.salesProfit ?? 0) >= 0 ? 'text-[#1F9D55]' : 'text-[#E5484D]'}
                    />
                    <Stat label="STOCK COST" value={formatKES(summary.purchaseCost)} />
                    <Stat label="EXPENSES" value={formatKES(summary.expenditures)} />
                    <Stat label="WITHDRAWALS" value={formatKES(summary.withdrawals)} />
                    <Stat label="LOANS OUT" value={formatKES(summary.loansOutstanding)} />
                    <Stat
                      label="ACTIVITY"
                      value={`${counts.batches ?? 0} batches · ${counts.sales ?? 0} sales · ${counts.loans ?? 0} loans`}
                    />
                  </div>
                ) : null}
              </div>
            )}

            {tab !== 'overview' && (
              <div>
                {tabLoading ? (
                  <p className="text-[13px] text-[#8A8A8A] py-4 text-center">Loading {tab}…</p>
                ) : tabError ? (
                  <p className="text-[13px] font-medium text-[#E5484D] bg-[#FDECEC] rounded-[10px] px-3 py-2">{tabError}</p>
                ) : tab === 'capital' ? (
                  <div>
                    {capitalDetail && (
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                        <Stat label="STARTING" value={formatKES(capitalDetail.startingCapital)} />
                        <Stat label="TOPPED UP" value={formatKES(capitalDetail.manualAdditions)} />
                        <Stat label="NOW" value={formatKES(capitalDetail.currentCapital)} />
                        <Stat label="SALES IN" value={formatKES(capitalDetail.salesRevenue)} />
                      </div>
                    )}
                    {tabRows.length === 0 ? (
                      <p className="text-[13px] text-[#8A8A8A] py-4 text-center">No top-ups recorded.</p>
                    ) : (
                      tabRows.map((a) => (
                        <div key={a.id} className="flex items-center justify-between text-[13px] py-2 border-b border-[#F1EDE2] last:border-0">
                          <span className="text-[#5C5C5C] truncate">{a.note || 'Manual top-up'} · {formatDate(a.createdAt)}</span>
                          <span className="font-semibold tabular text-[#1F9D55]">+{formatKES(a.amount)}</span>
                        </div>
                      ))
                    )}
                  </div>
                ) : tabRows.length === 0 ? (
                  <p className="text-[13px] text-[#8A8A8A] py-4 text-center">No {tab} for this account yet.</p>
                ) : (
                  <div className="flex flex-col max-h-[320px] overflow-y-auto">
                    {tab === 'batches' && tabRows.map((b) => (
                      <div key={b.id} className="flex items-center justify-between text-[13px] py-2 border-b border-[#F1EDE2] last:border-0 gap-2">
                        <span className="font-semibold truncate">{b.batchNumber} · {b.itemName} · {formatGrams(b.gramsRemaining)} left</span>
                        <span className="tabular text-[#8A8A8A] shrink-0">{formatDate(b.purchaseDate)} · {b.status}</span>
                      </div>
                    ))}
                    {tab === 'sales' && tabRows.map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-[13px] py-2 border-b border-[#F1EDE2] last:border-0 gap-2">
                        <span className="font-semibold truncate">{s.batchNumber} · {formatGrams(s.gramsSold)} · {formatDate(s.saleDate)}</span>
                        <span className="text-right shrink-0">
                          <span className="block font-bold tabular">{formatKES(s.totalSellingPrice)}</span>
                          <span className={`block text-[12px] tabular font-medium ${(s.profitLoss ?? 0) >= 0 ? 'text-[#1F9D55]' : 'text-[#E5484D]'}`}>
                            {(s.profitLoss ?? 0) >= 0 ? '+' : ''}{formatKES(s.profitLoss)}
                          </span>
                        </span>
                      </div>
                    ))}
                    {tab === 'loans' && tabRows.map((l) => (
                      <div key={l.id} className="flex items-center justify-between text-[13px] py-2 border-b border-[#F1EDE2] last:border-0 gap-2">
                        <span className="font-semibold truncate">{l.borrowerName} · {l.status}</span>
                        <span className="tabular shrink-0">{formatKES(l.amountGiven)} given · {formatKES(l.amountRepaid)} repaid</span>
                      </div>
                    ))}
                    {tab === 'expenditures' && tabRows.map((e) => (
                      <div key={e.id} className="flex items-center justify-between text-[13px] py-2 border-b border-[#F1EDE2] last:border-0 gap-2">
                        <span className="font-semibold truncate">{e.category} · {e.description || '—'}</span>
                        <span className="tabular shrink-0">{formatKES(e.amount)} · {formatDate(e.expenseDate)}</span>
                      </div>
                    ))}
                    {tab === 'withdrawals' && tabRows.map((w) => (
                      <div key={w.id} className="flex items-center justify-between text-[13px] py-2 border-b border-[#F1EDE2] last:border-0 gap-2">
                        <span className="font-semibold truncate">{w.reason || 'Withdrawal'}</span>
                        <span className="tabular shrink-0">{formatKES(w.amount)} · {formatDate(w.withdrawalDate)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[14px] font-bold">All users</h2>
          <span className="text-[12px] text-[#8A8A8A]">Toggle = killswitch</span>
        </div>

        {loading && users.length === 0 ? (
          <p className="text-[13px] text-[#8A8A8A] py-8 text-center">Loading users…</p>
        ) : filtered.length === 0 ? (
          <p className="text-[13px] text-[#8A8A8A] py-8 text-center">No users yet.</p>
        ) : (
          <div className="flex flex-col">
            {filtered.map((u) => {
              const isSelf = me && Number(me.id) === Number(u.id);
              const locked = isSelf || u.isAdmin;
              return (
                <div key={u.id} className="py-3 border-b border-[#F1EDE2] last:border-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => {
                        setSelectedId(u.id);
                        setTab('overview');
                        document.querySelector('#track-user-data')?.scrollIntoView?.();
                      }}
                      title="Track this account's data"
                      className="w-10 h-10 rounded-xl bg-[#F6F1E8] flex items-center justify-center font-bold text-[15px] shrink-0 hover:bg-[#EFE7D6]"
                    >
                      {(u.name || u.email || 'U').slice(0, 1).toUpperCase()}
                    </button>
                    <span className="flex-1 min-w-[180px]">
                      <span className="block text-[13px] font-semibold truncate">
                        {u.name || 'Unnamed'}
                        {u.isAdmin && (
                          <span className="ml-2 text-[11px] font-bold px-2 py-0.5 rounded-full bg-black text-white align-middle">
                            ADMIN
                          </span>
                        )}
                        {u.isSuspended && (
                          <span className="ml-2 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FDECEC] text-[#B42318] align-middle">
                            PAUSED
                          </span>
                        )}
                        {u.twofaEnabled ? (
                          <span className="ml-2 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#E6F4EA] text-[#137333] align-middle">
                            2FA ON
                          </span>
                        ) : u.twofaExempt ? (
                          <span className="ml-2 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FFFAEB] border border-[#FEDF89] text-[#5C4B00] align-middle">
                            2FA OFF · APPROVED
                          </span>
                        ) : (
                          <span className="ml-2 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#F3F3F3] text-[#5C5C5C] align-middle">
                            2FA OFF
                          </span>
                        )}
                        {pendingUserIds.has(Number(u.id)) && (
                          <span className="ml-2 text-[11px] font-bold px-2 py-0.5 rounded-full bg-black text-white align-middle">
                            WANTS 2FA OFF
                          </span>
                        )}
                      </span>
                      <span className="block text-[12px] text-[#8A8A8A] truncate">
                        {u.email} · joined {formatDate(u.createdAt)}
                      </span>
                    </span>
                    <button
                      onClick={() => {
                        setSelectedId(u.id);
                        setTab('overview');
                      }}
                      className={`text-[12px] font-semibold px-3 py-1.5 rounded-full border shrink-0 ${
                        Number(selectedId) === Number(u.id)
                          ? 'bg-black text-white border-black'
                          : 'border-[#E3DCCB] hover:border-black'
                      }`}
                    >
                      {Number(selectedId) === Number(u.id) ? 'Tracking' : 'Track'}
                    </button>
                    <label className="flex items-center gap-2 text-[13px] font-medium shrink-0 select-none">
                      <span className={u.isSuspended ? 'text-[#B42318] font-bold' : 'text-[#8A8A8A]'}>
                        {u.isSuspended ? 'Paused' : 'Active'}
                      </span>
                      <button
                        role="switch"
                        aria-checked={!!u.isSuspended}
                        disabled={locked || busyId === u.id}
                        onClick={() => handleToggle(u)}
                        title={locked ? 'Admin accounts cannot be paused' : u.isSuspended ? 'Resume services' : 'Pause services'}
                        className={`w-11 h-6 rounded-full relative transition-colors disabled:opacity-40 ${
                          u.isSuspended ? 'bg-[#B42318]' : 'bg-[#E3DCCB]'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                            u.isSuspended ? 'left-[22px]' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </label>
                  </div>

                  {!locked && (
                    <div className="mt-2 flex flex-col sm:flex-row gap-2 sm:items-start">
                      <input
                        value={reasons[u.id] ?? ''}
                        onChange={(e) => setReasons((p) => ({ ...p, [u.id]: e.target.value }))}
                        placeholder={
                          u.isSuspended
                            ? 'Paused for: (shown to the user)'
                            : 'Reason for pausing — user will see this…'
                        }
                        maxLength={1000}
                        disabled={busyId === u.id}
                        className="flex-1"
                      />
                      <button
                        onClick={() => handleToggle(u)}
                        disabled={busyId === u.id}
                        className={`px-4 py-2.5 text-[13px] font-semibold rounded-[10px] h-[42px] whitespace-nowrap disabled:opacity-50 ${
                          u.isSuspended ? 'bg-black text-white hover:bg-[#333]' : 'bg-[#B42318] text-white hover:bg-[#8A1A12]'
                        }`}
                      >
                        {busyId === u.id ? 'Saving…' : u.isSuspended ? 'Resume' : 'Pause + send reason'}
                      </button>
                    </div>
                  )}
                  {locked && (
                    <p className="text-[12px] text-[#8A8A8A] mt-1.5">
                      {isSelf ? 'This is you (admin — cannot be paused).' : 'Admin account — cannot be paused.'}
                    </p>
                  )}
                  {!locked && u.twofaExempt && (
                    <div className="mt-1.5">
                      <button
                        onClick={() => handleRevokeExempt(u)}
                        disabled={busyExemptId === u.id}
                        className="text-[12px] font-semibold px-3 py-1.5 rounded-full border border-[#E3DCCB] hover:border-black disabled:opacity-50"
                      >
                        {busyExemptId === u.id ? 'Saving…' : 'Require authenticator again'}
                      </button>
                    </div>
                  )}
                  {u.isSuspended && u.suspensionReason && (
                    <p className="text-[12px] mt-1.5 px-3 py-2 rounded-[10px] bg-[#FFFAEB] border border-[#FEDF89] text-[#5C4B00]">
                      <span className="font-bold">User sees:</span> “Your services have been paused due to: {u.suspensionReason}”
                    </p>
                  )}
                  {rowError[u.id] && (
                    <p className="text-[13px] font-medium text-[#E5484D] bg-[#FDECEC] rounded-[10px] px-3 py-2 mt-2">
                      {rowError[u.id]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-[12px] text-[#8A8A8A] mt-3 leading-snug">
        Pausing blocks that account&apos;s batches, sales, loans, expenditures, withdrawals and capital APIs
        (403 ACCOUNT_SUSPENDED). They stay signed in and see your reason. Only you (admin) can resume them.
        Authenticator requests are handled on the <Link to="/requests" className="font-semibold underline">Requests page</Link> —
        approving turns that account&apos;s 2FA off for good, and “Require authenticator again” below reverses it
        (overdue accounts are then blocked until they re-enable).
      </p>
    </div>
  );
}
