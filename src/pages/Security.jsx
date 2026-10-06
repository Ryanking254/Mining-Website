import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  get2faStatus,
  setup2fa,
  confirm2fa,
  request2faDisable,
  getMy2faDisableRequests,
  cancel2faDisableRequest,
} from '../lib/api';
import { useAuth } from '../lib/useAuth.jsx';
import { getTwofaState } from '../lib/twofa';

export default function Security() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const twofa = getTwofaState(user);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Setup flow
  const [setup, setSetup] = useState(null); // { secret, otpauthUrl, qrDataUrl }
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [working, setWorking] = useState(false);

  // Disable-request flow (2FA stays ON until an admin approves)
  const [history, setHistory] = useState([]);
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [disableReason, setDisableReason] = useState('');
  const [disableWorking, setDisableWorking] = useState(false);

  const pendingRequest = status?.disableRequest
    || history.find((r) => r.status === 'PENDING')
    || null;
  const lastDecision = history.find((r) => r.status === 'REJECTED' || r.status === 'APPROVED') || null;

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [{ data }, historyRes] = await Promise.all([
        get2faStatus(),
        getMy2faDisableRequests().catch(() => ({ data: [] })),
      ]);
      setStatus(data);
      setHistory(Array.isArray(historyRes?.data) ? historyRes.data : []);
      // Sync the auth context too (twofaEnabled/twofaExempt) so the banner
      // and route guards pick up an admin approval without re-login.
      try { await refreshUser(); } catch { /* ignore — status already reloaded */ }
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not load 2FA status.');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const startSetup = async () => {
    setError(''); setSuccess(''); setWorking(true);
    try {
      const { data } = await setup2fa();
      setSetup(data);
      setBackupCodes([]);
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not start 2FA setup.');
    } finally {
      setWorking(false);
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setWorking(true);
    try {
      const wasOverdue = !getTwofaState(user).enabled && getTwofaState(user).overdue;
      const wasAdmin = !!user?.isAdmin;
      const { data } = await confirm2fa(code.trim());
      setBackupCodes(data.backupCodes || []);
      setSetup(null);
      setCode('');
      setSuccess('Two-factor authentication is now enabled.');
      await load();
      let updated = null;
      try { updated = await refreshUser(); } catch { /* ignore — status already reloaded */ }
      // Overdue accounts were force-redirected here — send them home
      // (admins back to /admin, everyone else to /).
      if (wasOverdue) navigate((updated?.isAdmin ?? wasAdmin) ? '/admin' : '/', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.error || 'Invalid code. Try again.');
    } finally {
      setWorking(false);
    }
  };

  const handleRequestDisable = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setDisableWorking(true);
    try {
      const { data } = await request2faDisable(disableReason.trim());
      if (data?.request) {
        setHistory((prev) => [data.request, ...prev.filter((r) => r.id !== data.request.id)]);
      } else {
        await load();
      }
      setShowDisableForm(false);
      setDisableReason('');
      setSuccess(data?.message || 'Request sent. Nothing changes until an admin approves.');
    } catch (err) {
      // Already have a pending request (409) — surface it instead of erroring.
      if (err?.response?.status === 409 && err?.response?.data?.request) {
        const existing = err.response.data.request;
        setHistory((prev) => [existing, ...prev.filter((r) => r.id !== existing.id)]);
        setShowDisableForm(false);
        setSuccess('You already have a pending request. Nothing changes until an admin approves.');
      } else {
        setError(err?.response?.data?.error || 'Could not send the request. Try again.');
      }
    } finally {
      setDisableWorking(false);
    }
  };

  const handleCancelRequest = async () => {
    setError(''); setSuccess(''); setDisableWorking(true);
    try {
      const { data } = await cancel2faDisableRequest();
      if (data?.request) {
        setHistory((prev) => [data.request, ...prev.filter((r) => r.id !== data.request.id)]);
      } else {
        await load();
      }
      setSuccess('Request cancelled. Nothing changes on your account.');
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not cancel the request. Try again.');
    } finally {
      setDisableWorking(false);
    }
  };

  return (
    <div className="max-w-[640px]">
      <h1 className="text-xl font-bold tracking-tight">Security</h1>
      <p className="text-[13px] text-[#8A8A8A] mt-1 mb-5">
        Signed in as <span className="font-semibold text-black">{user?.email}</span>.
        Add Google Authenticator (or any TOTP app) as a second step after your password or Google sign-in.
      </p>

      {loading ? (
        <p className="text-[13px] text-[#8A8A8A]">Loading…</p>
      ) : (
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-bold">Authenticator app (TOTP)</p>
              <p className="text-[13px] text-[#8A8A8A] mt-0.5">
                {status?.enabled
                  ? `Enabled${status?.backupCodesRemaining != null ? ` · ${status.backupCodesRemaining} backup codes left` : ''}`
                  : 'Not enabled — your account is protected by password / Google only.'}
              </p>
            </div>
            <span
              className={`text-[12px] font-bold px-2.5 py-1 rounded-full ${status?.enabled ? 'bg-[#E6F4EA] text-[#137333]' : 'bg-[#F3F3F3] text-[#5C5C5C]'}`}
            >
              {status?.enabled ? 'ON' : 'OFF'}
            </span>
          </div>

          {user && !twofa.enabled && twofa.overdue && (
            <p className="text-[13px] font-medium text-[#B42318] bg-[#FDECEC] rounded-[10px] px-3 py-2 mt-4">
              Authenticator setup is required — your grace period has ended. Enable it below to keep using the ledger.
            </p>
          )}
          {user && !twofa.enabled && !twofa.exempt && !twofa.overdue && (
            <p className="text-[13px] font-medium text-[#5C4B00] bg-[#FFFAEB] border border-[#FEDF89] rounded-[10px] px-3 py-2 mt-4">
              Reminder: the authenticator app becomes compulsory {twofa.graceDays} days after account creation
              ({twofa.daysLeft} day{twofa.daysLeft === 1 ? '' : 's'} left).
            </p>
          )}
          {(status?.exempt || user?.twofaExempt) && !status?.enabled && (
            <p className="text-[13px] text-[#5C5C5C] bg-[#F6F6F6] rounded-[10px] px-3 py-2 mt-4">
              Two-factor authentication is disabled with admin approval. You can re-enable it below at any time
              (re-enabling clears the approval).
            </p>
          )}
          {status?.enabled && !pendingRequest && (
            <p className="text-[13px] text-[#5C5C5C] bg-[#F6F6F6] rounded-[10px] px-3 py-2 mt-4">
              Two-factor authentication is enabled. You can ask an admin to disable it — it stays on until approved.
            </p>
          )}
          {pendingRequest && (
            <div className="text-[13px] bg-[#FFFAEB] border border-[#FEDF89] rounded-[10px] px-3 py-2 mt-4">
              <p className="font-bold text-[#5C4B00]">
                {status?.enabled ? 'Disable request pending' : 'Exemption request pending'}
              </p>
              <p className="text-[#5C5C5C] mt-0.5">
                Sent {pendingRequest.createdAt ? new Date(pendingRequest.createdAt).toLocaleString() : ''}.
                {status?.enabled
                  ? ' Your authenticator stays enabled until an admin approves.'
                  : ' The authenticator requirement stays in place — your ledger stays blocked until an admin approves.'}
                {pendingRequest.reason ? ` Your reason: “${pendingRequest.reason}”` : ''}
              </p>
              <button
                onClick={handleCancelRequest}
                disabled={disableWorking}
                className="mt-2 text-[13px] font-semibold px-3 py-1.5 rounded-[10px] border border-[#E3DCCB] bg-white hover:border-black disabled:opacity-50"
              >
                {disableWorking ? 'Cancelling…' : 'Cancel request'}
              </button>
            </div>
          )}
          {!pendingRequest && lastDecision?.status === 'REJECTED' && (
            <p className="text-[13px] text-[#5C5C5C] bg-[#F6F6F6] rounded-[10px] px-3 py-2 mt-4">
              Your last request was declined by an admin.
              {lastDecision.adminNote ? ` Note: “${lastDecision.adminNote}”` : ''} You can send a new request below.
            </p>
          )}

          {error && (
            <p className="text-[13px] font-medium text-[#E5484D] bg-[#FDECEC] rounded-[10px] px-3 py-2 mt-4">{error}</p>
          )}
          {success && (
            <p className="text-[13px] font-medium text-[#137333] bg-[#E6F4EA] rounded-[10px] px-3 py-2 mt-4">{success}</p>
          )}

          {!status?.enabled && !setup && (
            <button
              onClick={startSetup}
              disabled={working}
              className="bg-black text-white px-4 py-2.5 text-[14px] font-semibold rounded-[10px] disabled:opacity-50 mt-4"
            >
              {working ? 'Please wait…' : 'Enable with authenticator app'}
            </button>
          )}

          {setup && (
            <div className="mt-4">
              <p className="text-[13px] font-semibold">1. Scan this QR code in Google Authenticator</p>
              <div className="mt-2 inline-block bg-white p-3 rounded-[12px] border border-[#ECECEC]">
                <img src={setup.qrDataUrl} alt="2FA QR code" className="w-[200px] h-[200px]" />
              </div>
              <p className="text-[13px] text-[#8A8A8A] mt-3">
                Can&apos;t scan? Enter this secret manually:
              </p>
              <code className="block mt-1 text-[13px] font-mono bg-[#F6F6F6] rounded-[8px] px-3 py-2 break-all select-all">
                {setup.secret}
              </code>
              <form onSubmit={handleConfirm} className="flex flex-col sm:flex-row gap-2 mt-4">
                <input
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="6-digit code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="tracking-widest text-center font-mono sm:max-w-[180px]"
                />
                <button
                  type="submit"
                  disabled={working}
                  className="bg-black text-white px-4 py-2.5 text-[14px] font-semibold rounded-[10px] disabled:opacity-50"
                >
                  {working ? 'Verifying…' : 'Verify & enable'}
                </button>
              </form>
            </div>
          )}

          {backupCodes.length > 0 && (
            <div className="mt-4 bg-[#FFFAEB] border border-[#FEDF89] rounded-[12px] p-4">
              <p className="text-[13px] font-bold">Save your backup codes</p>
              <p className="text-[13px] text-[#5C5C5C] mt-1">
                Each code works once if you lose your phone. Store them somewhere safe — they won&apos;t be shown again.
              </p>
              <div className="grid grid-cols-2 gap-1.5 mt-3 font-mono text-[13px]">
                {backupCodes.map((c) => (
                  <code key={c} className="bg-white rounded-[8px] px-2 py-1.5 text-center border border-[#ECECEC]">{c}</code>
                ))}
              </div>
            </div>
          )}

          {/* Request disable/exemption — nothing changes until an admin approves. */}
          {status?.enabled && !pendingRequest && !showDisableForm && (
            <button
              onClick={() => { setShowDisableForm(true); setError(''); setSuccess(''); }}
              className="text-[13px] font-semibold px-4 py-2.5 rounded-[10px] border border-[#E3DCCB] bg-white hover:border-black mt-4"
            >
              Request to disable authenticator
            </button>
          )}
          {!status?.enabled && !status?.exempt && !pendingRequest && !showDisableForm && (
            <div className="mt-4 border border-[#ECECEC] rounded-[12px] p-4">
              <p className="text-[13px] font-bold">Can&apos;t use an authenticator app?</p>
              <p className="text-[13px] text-[#8A8A8A] mt-1">
                {twofa.overdue
                  ? 'Ask the admin for an exemption instead — you stay blocked from the ledger until it is approved.'
                  : 'You can ask the admin for an exemption from the compulsory setup.'}
              </p>
              <button
                onClick={() => { setShowDisableForm(true); setError(''); setSuccess(''); }}
                className="text-[13px] font-semibold px-4 py-2.5 rounded-[10px] border border-[#E3DCCB] bg-white hover:border-black mt-2"
              >
                Request exemption
              </button>
            </div>
          )}
          {!pendingRequest && showDisableForm && !status?.exempt && (
            <form onSubmit={handleRequestDisable} className="mt-4 border border-[#ECECEC] rounded-[12px] p-4">
              <p className="text-[13px] font-bold">
                {status?.enabled ? 'Request to disable' : 'Request exemption'}
              </p>
              <p className="text-[13px] text-[#8A8A8A] mt-1">
                {status?.enabled
                  ? 'Tell the admin why (optional). Your authenticator keeps working until the request is approved.'
                  : 'Tell the admin why (optional). Nothing changes until the request is approved.'}
              </p>
              <textarea
                value={disableReason}
                onChange={(e) => setDisableReason(e.target.value)}
                placeholder={status?.enabled ? 'e.g. Lost my phone, need to set up a new one…' : 'e.g. No smartphone, SMS-only device…'}
                maxLength={1000}
                rows={3}
                className="w-full mt-2"
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="submit"
                  disabled={disableWorking}
                  className="bg-black text-white px-4 py-2.5 text-[14px] font-semibold rounded-[10px] disabled:opacity-50"
                >
                  {disableWorking ? 'Sending…' : 'Send request'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowDisableForm(false); setDisableReason(''); }}
                  disabled={disableWorking}
                  className="text-[13px] font-semibold px-4 py-2.5 rounded-[10px] border border-[#E3DCCB] hover:border-black disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="card p-5 mt-4">
        <p className="text-[14px] font-bold">Google sign-in</p>
        <p className="text-[13px] text-[#8A8A8A] mt-0.5">
          {user?.googleLinked
            ? 'Your Google account is linked — you can sign in with Google.'
            : 'No Google account linked. Sign in with Google using the same email to link it automatically.'}
        </p>
        <p className="text-[13px] text-[#8A8A8A] mt-2">
          {user?.hasPassword === false
            ? 'This account has no password (Google-only). Set one via password reset if you need email login.'
            : 'Password login is available for this account.'}
        </p>
      </div>
    </div>
  );
}
