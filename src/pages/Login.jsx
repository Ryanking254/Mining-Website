import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/useAuth.jsx';

export default function Login({ initialMode = 'login' }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState(initialMode); // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login({ email: form.email.trim(), password: form.password });
      } else {
        await register({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        });
      }
      navigate('/', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.error || 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

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
      </div>
    </div>
  );
}
