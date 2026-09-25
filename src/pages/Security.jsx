import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get2faStatus, setup2fa, confirm2fa } from '../lib/api';
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

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await get2faStatus();
      setStatus(data);
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not load 2FA status.');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
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
      const { data } = await confirm2fa(code.trim());
      setBackupCodes(data.backupCodes || []);
      setSetup(null);
      setCode('');
      setSuccess('Two-factor authentication is now enabled.');
      await load();
      try { await refreshUser(); } catch { /* ignore — status already reloaded */ }
      if (wasOverdue) navigate('/', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.error || 'Invalid code. Try again.');
    } finally {
      setWorking(false);
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
          {user && !twofa.enabled && !twofa.overdue && (
            <p className="text-[13px] font-medium text-[#5C4B00] bg-[#FFFAEB] border border-[#FEDF89] rounded-[10px] px-3 py-2 mt-4">
              Reminder: the authenticator app becomes compulsory {twofa.graceDays} days after account creation
              ({twofa.daysLeft} day{twofa.daysLeft === 1 ? '' : 's'} left). It cannot be disabled once enabled.
            </p>
          )}
          {status?.enabled && (
            <p className="text-[13px] text-[#5C5C5C] bg-[#F6F6F6] rounded-[10px] px-3 py-2 mt-4">
              Two-factor authentication is enabled and mandatory — it cannot be disabled.
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

          {/* Disabling is not offered — 2FA is mandatory. */}
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
