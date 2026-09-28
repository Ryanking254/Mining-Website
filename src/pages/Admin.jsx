import { useEffect, useState } from 'react';
import { getAdminUsers, setUserSuspension } from '../lib/api';
import { formatDate } from '../lib/format';
import { useAuth } from '../lib/useAuth.jsx';

export default function Admin() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reasons, setReasons] = useState({}); // userId -> reason text
  const [busyId, setBusyId] = useState(null);
  const [rowError, setRowError] = useState({}); // userId -> error

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await getAdminUsers();
      const list = Array.isArray(data) ? data : [];
      setUsers(list);
      setReasons((prev) => {
        const next = { ...prev };
        for (const u of list) {
          if (!(u.id in next)) next[u.id] = u.suspensionReason || '';
        }
        return next;
      });
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

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

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Admin</h1>
          <p className="text-[13px] text-[#8A8A8A]">
            {users.length} account{users.length === 1 ? '' : 's'} · killswitch pauses a user&apos;s services
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

      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[14px] font-bold">All users</h2>
          <span className="text-[12px] text-[#8A8A8A]">Toggle = killswitch</span>
        </div>

        {loading && users.length === 0 ? (
          <p className="text-[13px] text-[#8A8A8A] py-8 text-center">Loading users…</p>
        ) : users.length === 0 ? (
          <p className="text-[13px] text-[#8A8A8A] py-8 text-center">No users yet.</p>
        ) : (
          <div className="flex flex-col">
            {users.map((u) => {
              const isSelf = me && Number(me.id) === Number(u.id);
              const locked = isSelf || u.isAdmin;
              return (
                <div key={u.id} className="py-3 border-b border-[#F1EDE2] last:border-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="w-10 h-10 rounded-xl bg-[#F6F1E8] flex items-center justify-center font-bold text-[15px] shrink-0">
                      {(u.name || u.email || 'U').slice(0, 1).toUpperCase()}
                    </span>
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
                      </span>
                      <span className="block text-[12px] text-[#8A8A8A] truncate">
                        {u.email} · joined {formatDate(u.createdAt)}
                      </span>
                    </span>
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
      </p>
    </div>
  );
}
