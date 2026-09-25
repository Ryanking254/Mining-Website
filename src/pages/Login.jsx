import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../lib/useAuth.jsx';

const googleConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

export default function Login({ initialMode = 'login' }) {
  const { login, register, loginWithGoogle, verify2fa } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState(initialMode); // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 2FA step — set when the server replies { requires2fa, pendingToken }.
  const [pendingToken, setPendingToken] = useState('');
  const [twofaCode, setTwofaCode] = useState('');
  const [twofaIsBackup, setTwofaIsBackup] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const done = () => navigate('/', { replace: true });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        const data = await login({ email: form.email.trim(), password: form.password });
        if (data?.requires2fa) {
          setPendingToken(data.pendingToken);
          return;
        }
      } else {
        const data = await register({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        });
        if (data?.requires2fa) {
          setPendingToken(data.pendingToken);
          return;
        }
      }
      done();
    } catch (err) {
      setError(err?.response?.data?.error || 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    const idToken = credentialResponse?.credential;
    if (!idToken) {
      setError('Google sign-in failed. Try again.');
      return;
    }
    setSubmitting(true);
    try {
      const data = await loginWithGoogle(idToken);
      if (data?.requires2fa) {
        setPendingToken(data.pendingToken);
        return;
      }
      done();
    } catch (err) {
      setError(err?.response?.data?.error || 'Google sign-in failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handle2faSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!twofaCode.trim()) {
      setError('Enter the code from your authenticator app.');
      return;
    }
    setVerifying(true);
    try {
      await verify2fa(pendingToken, twofaCode.trim(), { isBackup: twofaIsBackup });
      done();
    } catch (err) {
      setError(err?.response?.data?.error || 'Invalid code. Try again.');
    } finally {
      setVerifying(false);
    }
  };

  // ---- 2FA challenge screen ----
  if (pendingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card p-6 w-full max-w-[400px]">
          <h1 className="text-xl font-bold tracking-tight">Two-step verification</h1>
          <p className="text-[13px] text-[#8A8A8A] mt-1 mb-4">
            {twofaIsBackup
              ? 'Enter one of your single-use backup codes.'
              : 'Open Google Authenticator (or any TOTP app) and enter the 6-digit code.'}
          </p>
          <form onSubmit={handle2faSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C]">
              {twofaIsBackup ? 'Backup code' : 'Authenticator code'}
              <input
                required
                autoFocus
                value={twofaCode}
                onChange={(e) => setTwofaCode(e.target.value)}
                placeholder={twofaIsBackup ? 'e.g. A1B2C3D4E5' : '6-digit code'}
                inputMode={twofaIsBackup ? 'text' : 'numeric'}
                autoComplete="one-time-code"
                maxLength={twofaIsBackup ? 16 : 6}
                className="tracking-widest text-center text-lg font-mono"
              />
            </label>
            {error && (
              <p className="text-[13px] font-medium text-[#E5484D] bg-[#FDECEC] rounded-[10px] px-3 py-2">{error}</p>
            )}
            <button
              type="submit"
              disabled={verifying}
              className="bg-black text-white px-4 py-2.5 text-[14px] font-semibold rounded-[10px] disabled:opacity-50 mt-1"
            >
              {verifying ? 'Verifying…' : 'Verify & sign in'}
            </button>
          </form>
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => { setTwofaIsBackup(!twofaIsBackup); setTwofaCode(''); setError(''); }}
              className="text-[13px] text-[#E8620C] font-semibold hover:underline"
            >
              {twofaIsBackup ? 'Use authenticator code' : 'Use a backup code'}
            </button>
            <button
              onClick={() => { setPendingToken(''); setTwofaCode(''); setError(''); }}
              className="text-[13px] text-[#8A8A8A] font-medium hover:underline"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card p-6 w-full max-w-[400px]">
        <div className="flex items-center gap-2 mb-5">
          <span className="logo-dot">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="white" strokeWidth="2.4">
              <circle cx="12" cy="12" r="6.5" />
              <circle cx="12" cy="12" r="1.6" fill="white" stroke="none" />
            </svg>
          </span>
          <span className="font-bold text-[16px] tracking-tight">Ledger</span>
        </div>

        <h1 className="text-xl font-bold tracking-tight">
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h1>
        <p className="text-[13px] text-[#8A8A8A] mt-1 mb-4">
          {mode === 'login'
            ? 'Sign in to access your mining ledger.'
            : 'Register to start tracking your mining ledger.'}
        </p>

        {googleConfigured ? (
          <>
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google sign-in failed. Try again.')}
                useOneTap={false}
                text={mode === 'login' ? 'signin_with' : 'signup_with'}
                shape="rectangular"
              />
            </div>
            <div className="flex items-center gap-3 my-4">
              <span className="flex-1 h-px bg-[#ECECEC]" />
              <span className="text-[12px] text-[#8A8A8A]">or with email</span>
              <span className="flex-1 h-px bg-[#ECECEC]" />
            </div>
          </>
        ) : null}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === 'register' && (
            <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C]">Name
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Your full name"
                autoComplete="name"
              />
            </label>
          )}
          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C]">Email
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-[#5C5C5C]">Password
            <input
              required
              type="password"
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={mode === 'register' ? 'Min. 6 characters' : 'Your password'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>

          {error && (
            <p className="text-[13px] font-medium text-[#E5484D] bg-[#FDECEC] rounded-[10px] px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="bg-black text-white px-4 py-2.5 text-[14px] font-semibold rounded-[10px] disabled:opacity-50 mt-1"
          >
            {submitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="text-[13px] text-[#8A8A8A] mt-4 text-center">
          {mode === 'login' ? (
            <>No account yet?{' '}
              <button onClick={() => { setMode('register'); setError(''); }} className="text-[#E8620C] font-semibold hover:underline">
                Register
              </button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button onClick={() => { setMode('login'); setError(''); }} className="text-[#E8620C] font-semibold hover:underline">
                Sign in
              </button>
            </>
          )}
        </p>

        {!googleConfigured && (
          <p className="text-[12px] text-[#8A8A8A] mt-4 text-center leading-snug">
            Google sign-in is not configured yet. Add <code>VITE_GOOGLE_CLIENT_ID</code> to enable it.
          </p>
        )}
      </div>
    </div>
  );
}
