import { useEffect, useState } from 'react';
import {
  getAdmin2faDisableRequests,
  approve2faDisableRequest,
  reject2faDisableRequest,
} from '../lib/api';
import { formatDate } from '../lib/format';

/**
 * Admin-only inbox for authenticator requests.
 * Any account can ask — with 2FA on (wants it off) or never enabled,
 * including overdue accounts blocked from the ledger. Nothing changes
 * until the admin decides here. Approving turns an enabled authenticator
 * OFF, or exempts a never-enabled account from compulsory setup — either
 * way they keep full ledger access without 2FA. Declining keeps everything
 * as is.
 */
export default function Requests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [rejectNotes, setRejectNotes] = useState({}); // requestId -> note text
  const [busyId, setBusyId] = useState(null);
  const [rowError, setRowError] = useState({}); // requestId -> error

  const load = async (history = showHistory) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await getAdmin2faDisableRequests(history ? 'ALL' : 'PENDING');
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not load requests.');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(false); }, []);

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;

  const handleApprove = async (r) => {
    setRowError((p) => ({ ...p, [r.id]: '' }));
    setSuccess('');
    setBusyId(r.id);
    try {
      await approve2faDisableRequest(r.id);
      setSuccess(
        `Approved — two-factor authentication is now OFF for ${r.user?.name || r.user?.email || 'that account'}.`
      );
      await load();
    } catch (err) {
      setRowError((p) => ({
        ...p,
        [r.id]: err?.response?.data?.error || 'Could not approve. Try again.',
      }));
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (r) => {
    const note = (rejectNotes[r.id] || '').trim();
    setRowError((p) => ({ ...p, [r.id]: '' }));
    setSuccess('');
    setBusyId(r.id);
    try {
      await reject2faDisableRequest(r.id, note || undefined);
      setRejectNotes((p) => ({ ...p, [r.id]: '' }));
      setSuccess(`Declined — 2FA stays as is for ${r.user?.name || r.user?.email || 'that account'}.`);
      await load();
    } catch (err) {
      setRowError((p) => ({
        ...p,
        [r.id]: err?.response?.data?.error || 'Could not decline. Try again.',
      }));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Authenticator requests
            {pendingCount > 0 && (
              <span className="ml-2 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FFFAEB] border border-[#FEDF89] text-[#5C4B00] align-middle">
                {pendingCount} PENDING
              </span>
            )}
          </h1>
          <p className="text-[13px] text-[#8A8A8A]">
            Accounts asking to go without the authenticator app — nothing changes until you decide
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const next = !showHistory;
              setShowHistory(next);
              load(next);
            }}
            className="text-[13px] font-semibold px-4 py-2 rounded-full border border-[#E3DCCB] bg-white hover:border-black"
          >
            {showHistory ? 'Show pending only' : 'Show history'}
          </button>
          <button
            onClick={() => load()}
            disabled={loading}
            className="text-[13px] font-semibold px-4 py-2 rounded-full border border-[#E3DCCB] bg-white hover:border-black disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-[13px] font-medium text-[#E5484D] bg-[#FDECEC] rounded-[10px] px-3 py-2 mb-3">{error}</p>
      )}
      {success && (
        <p className="text-[13px] font-medium text-[#137333] bg-[#E6F4EA] rounded-[10px] px-3 py-2 mb-3">{success}</p>
      )}

      <div className="card p-4">
        {loading && requests.length === 0 ? (
          <p className="text-[13px] text-[#8A8A8A] py-8 text-center">Loading requests…</p>
        ) : requests.length === 0 ? (
          <p className="text-[13px] text-[#8A8A8A] py-8 text-center">
            {showHistory ? 'No requests yet.' : 'No pending requests. You are all caught up.'}
          </p>
        ) : (
          <div className="flex flex-col">
            {requests.map((r) => (
              <div key={r.id} className="py-3 border-b border-[#F1EDE2] last:border-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="w-10 h-10 rounded-xl bg-[#F6F1E8] flex items-center justify-center font-bold text-[15px] shrink-0">
                    {((r.user?.name || r.user?.email || 'U')).slice(0, 1).toUpperCase()}
                  </span>
                  <span className="flex-1 min-w-[180px]">
                    <span className="block text-[13px] font-semibold truncate">
                      {r.user?.name || r.user?.email || `User #${r.user?.id}`}
                      <span
                        className={`ml-2 text-[11px] font-bold px-2 py-0.5 rounded-full align-middle ${
                          r.status === 'PENDING'
                            ? 'bg-[#FFFAEB] border border-[#FEDF89] text-[#5C4B00]'
                            : r.status === 'APPROVED'
                              ? 'bg-[#E6F4EA] text-[#137333]'
                              : r.status === 'REJECTED'
                                ? 'bg-[#FDECEC] text-[#B42318]'
                                : 'bg-[#F3F3F3] text-[#5C5C5C]'
                        }`}
                      >
                        {r.status}
                      </span>
                    </span>
                    <span className="block text-[12px] text-[#8A8A8A] truncate">
                      {r.user?.email} · requested {formatDate(r.createdAt)}
                      {r.user?.twofaEnabled === false && r.status === 'PENDING' ? ' · 2FA not enabled' : ''}
                      {r.user?.twofaEnabled === true && r.status === 'PENDING' ? ' · 2FA currently ON' : ''}
                    </span>
                  </span>
                  {r.status === 'PENDING' && (
                    <button
                      onClick={() => handleApprove(r)}
                      disabled={busyId === r.id}
                      className="px-4 py-2.5 text-[13px] font-semibold rounded-[10px] bg-black text-white hover:bg-[#333] disabled:opacity-50 shrink-0"
                    >
                      {busyId === r.id ? 'Saving…' : 'Approve (turn OFF)'}
                    </button>
                  )}
                </div>
                {r.reason && (
                  <p className="text-[12px] mt-1.5 px-3 py-2 rounded-[10px] bg-[#F6F1E8] text-[#5C5C5C]">
                    <span className="font-bold">User&apos;s reason:</span> “{r.reason}”
                  </p>
                )}
                {r.status === 'PENDING' && (
                  <div className="mt-2 flex flex-col sm:flex-row gap-2 sm:items-start">
                    <input
                      value={rejectNotes[r.id] ?? ''}
                      onChange={(e) => setRejectNotes((p) => ({ ...p, [r.id]: e.target.value }))}
                      placeholder="Decline note for the user (optional)…"
                      maxLength={1000}
                      disabled={busyId === r.id}
                      className="flex-1"
                    />
                    <button
                      onClick={() => handleReject(r)}
                      disabled={busyId === r.id}
                      className="px-4 py-2.5 text-[13px] font-semibold rounded-[10px] h-[42px] whitespace-nowrap border border-[#E3DCCB] hover:border-[#B42318] hover:text-[#B42318] disabled:opacity-50"
                    >
                      {busyId === r.id ? 'Saving…' : 'Decline (keep as is)'}
                    </button>
                  </div>
                )}
                {r.status !== 'PENDING' && (
                  <p className="text-[12px] text-[#8A8A8A] mt-1">
                    Decided {r.decidedAt ? formatDate(r.decidedAt) : ''}
                    {r.adminNote ? <> · note: “{r.adminNote}”</> : ''}
                  </p>
                )}
                {rowError[r.id] && (
                  <p className="text-[13px] font-medium text-[#E5484D] bg-[#FDECEC] rounded-[10px] px-3 py-2 mt-2">
                    {rowError[r.id]}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[12px] text-[#8A8A8A] mt-3 leading-snug">
        Approving an overdue account unblocks their ledger immediately — they will not be asked for an
        authenticator again unless you press “Require authenticator again” on their row in Admin.
      </p>
    </div>
  );
}
