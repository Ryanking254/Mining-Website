import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  OverviewIcon, BatchesIcon, SalesIcon, LoansIcon,
  ExpendituresIcon, WithdrawalsIcon, SecurityIcon, AdminIcon, BellIcon, SunIcon,
  MoonIcon, SearchIcon, LogoutIcon, MenuIcon, DownloadIcon,
} from './icons.jsx';
import { exportSales, getAdmin2faDisableRequests } from '../lib/api';
import { useAuth } from '../lib/useAuth.jsx';
import { getTwofaState } from '../lib/twofa';

const baseLinks = [
  { to: '/', label: 'Overview', end: true, Icon: OverviewIcon },
  { to: '/batches', label: 'Batches', Icon: BatchesIcon },
  { to: '/sales', label: 'Sales', Icon: SalesIcon },
  { to: '/loans', label: 'Loans', Icon: LoansIcon },
  { to: '/expenditures', label: 'Expenditures', Icon: ExpendituresIcon },
  { to: '/withdrawals', label: 'Withdrawals', Icon: WithdrawalsIcon },
  { to: '/security', label: 'Security', Icon: SecurityIcon },
];

function getInitialTheme() {
  try {
    const saved = localStorage.getItem('ledger-theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch { /* ignore */ }
  return 'light';
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState(getInitialTheme);
  const [downloading, setDownloading] = useState(false);
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Authenticator reminder — shown until 2FA is enabled. Dismissal lasts
  // until the next reload; overdue accounts cannot dismiss it.
  const [twofaDismissed, setTwofaDismissed] = useState(false);
  const twofaReminder = user && !user.twofaEnabled && !user.twofaExempt ? getTwofaState(user) : null;
  const showTwofaBanner = !user?.isSuspended && twofaReminder && (twofaReminder.overdue || !twofaDismissed);

  // Pending authenticator requests — admin nav badge + shared with the
  // Admin page via outlet context. Refreshed on every navigation.
  const [pending2fa, setPending2fa] = useState({ count: 0, userIds: [] });
  useEffect(() => {
    if (!user?.isAdmin) return;
    let cancelled = false;
    getAdmin2faDisableRequests('PENDING')
      .then(({ data }) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setPending2fa({
          count: list.length,
          userIds: list.map((r) => Number(r?.user?.id)).filter((n) => Number.isInteger(n)),
        });
      })
      .catch(() => {
        if (!cancelled) setPending2fa({ count: 0, userIds: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [user?.isAdmin, location.pathname]);

  const links = user?.isAdmin
    // Admins get Admin + Requests + Security only — no ledger pages (Overview,
    // Batches, Sales, Loans, Expenditures, Withdrawals). Security holds the
    // authenticator setup + Google sign-in status.
    ? [
        { to: '/admin', label: 'Admin', Icon: AdminIcon },
        { to: '/requests', label: 'Requests', Icon: BellIcon, badge: pending2fa.count },
        { to: '/security', label: 'Security', Icon: SecurityIcon },
      ]
    : baseLinks;

  const displayName = user?.name || user?.email || 'User';
  const initial = (displayName || 'U').slice(0, 1).toUpperCase();

  const handleLogout = () => {
    logout();
    setMobileOpen(false);
    navigate('/login', { replace: true });
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await exportSales();
      const url = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'sales.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      /* ignore — Sales page shows the same export with error handling */
    } finally {
      setDownloading(false);
      setMobileOpen(false);
    }
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try { localStorage.setItem('ledger-theme', theme); } catch { /* ignore */ }
  }, [theme]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') { setMobileOpen(false); }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // Killswitch: when any API returns 403 ACCOUNT_SUSPENDED, refresh /me so
  // the paused screen appears immediately with the admin's reason.
  useEffect(() => {
    function onSuspended() {
      refreshUser().catch(() => {});
    }
    window.addEventListener('account-suspended', onSuspended);
    return () => window.removeEventListener('account-suspended', onSuspended);
  }, [refreshUser]);

  const sidebar = (
    <div className="sidebar-inner">
      <div className="flex items-center gap-2 px-2">
        <span className="logo-dot">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="white" strokeWidth="2.4">
            <circle cx="12" cy="12" r="6.5" />
            <circle cx="12" cy="12" r="1.6" fill="white" stroke="none" />
          </svg>
        </span>
        <span className="font-bold text-[15px] tracking-tight">Ledger</span>
      </div>

      <p className="side-label">Main</p>
      <nav className="flex flex-col gap-0.5">
        {links.map(({ to, label, end, Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}
          >
            <span className="side-icon"><Icon className="w-[18px] h-[18px]" /></span>
            {label}
            {badge > 0 && (
              <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#B42318] text-white">
                {badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-4">
        {/* Ledger export is per-account — hidden for admins (they track
            other users' data from the Admin console instead). */}
        {!user?.isAdmin && (
          <div className="integrate-card">
            <p className="text-[13px] font-bold leading-snug">Sales Excel report</p>
            <p className="text-[12px] opacity-70 mt-0.5 leading-snug">Download all sales as an .xlsx Excel document for your records or accountant.</p>
            <button onClick={handleDownload} disabled={downloading} className="details-btn download-btn">
              <DownloadIcon className="w-3.5 h-3.5" />
              {downloading ? 'Preparing…' : 'Download'}
            </button>
          </div>
        )}
        <button onClick={handleLogout} className="side-link w-full text-left">
          <span className="side-icon"><LogoutIcon className="w-[18px] h-[18px]" /></span>
          Log Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="app-shell">
      {/* Desktop sidebar — transparent, no card, no scroll */}
      <aside className="app-sidebar">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <div className="mobile-drawer">{sidebar}</div>
        </div>
      )}

      {/* Main column — single opaque white panel */}
      <div className="main-col">
        <div className="main-panel">
          <header className="topbar">
            <button className="icon-btn lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <MenuIcon className="w-5 h-5" />
            </button>
            <div className="search-wrap">
              <span className="search-icon"><SearchIcon className="w-4 h-4" /></span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={user?.isAdmin ? 'Search users…' : 'Search transactions…'}
                className="search-input"
              />
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                className="icon-btn"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-label="Toggle dark mode"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark'
                  ? <SunIcon className="w-[18px] h-[18px]" />
                  : <MoonIcon className="w-[18px] h-[18px]" />}
              </button>

              <div className="user-chip" title={user?.email || ''}>
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="user-avatar object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="user-avatar">{initial}</div>
                )}
                <span className="text-[13px] font-medium hidden md:block">{displayName}</span>
              </div>
            </div>
          </header>

          <main className="main-body">
            {user?.isSuspended ? (
              <div className="min-h-[60vh] flex items-center justify-center p-4">
                <div className="card p-6 w-full max-w-[480px] text-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#FDECEC] text-[#B42318] flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                    !
                  </div>
                  <h1 className="text-xl font-bold tracking-tight">Your services have been paused</h1>
                  <p className="text-[13px] text-[#8A8A8A] mt-2 leading-snug">
                    {user?.suspensionReason
                      ? <>Due to: <span className="font-semibold text-black">{user.suspensionReason}</span></>
                      : 'Due to reasons from the administrator.'}
                  </p>
                  <p className="text-[13px] text-[#8A8A8A] mt-2 leading-snug">
                    Please contact support to resolve this. Your data is safe and will be
                    available once your account is resumed.
                  </p>
                  <button
                    onClick={handleLogout}
                    className="mt-4 px-4 py-2.5 text-[14px] font-semibold rounded-[10px] border border-[#E3DCCB] hover:border-black w-full"
                  >
                    Log out
                  </button>
                </div>
              </div>
            ) : (
              <>
                {showTwofaBanner && (
                  <div
                    className={`mb-3 flex items-center gap-3 rounded-[12px] px-4 py-3 text-[13px] ${
                      twofaReminder.overdue
                        ? 'bg-[#FDECEC] text-[#B42318]'
                        : 'bg-[#FFFAEB] text-[#5C4B00] border border-[#FEDF89]'
                    }`}
                  >
                    <p className="flex-1 leading-snug">
                      {twofaReminder.overdue ? (
                        <><span className="font-bold">Authenticator setup is required.</span> Enable it now to keep using the ledger.</>
                      ) : (
                        <><span className="font-bold">Protect your account.</span> Add an authenticator app — compulsory in {twofaReminder.daysLeft} day{twofaReminder.daysLeft === 1 ? '' : 's'}.</>
                      )}
                    </p>
                    <Link
                      to="/security"
                      className={`shrink-0 px-3 py-1.5 text-[13px] font-semibold rounded-[10px] ${
                        twofaReminder.overdue ? 'bg-[#B42318] text-white' : 'bg-black text-white'
                      }`}
                    >
                      Set up now
                    </Link>
                    {!twofaReminder.overdue && (
                      <button
                        onClick={() => setTwofaDismissed(true)}
                        aria-label="Dismiss reminder"
                        className="shrink-0 text-[13px] font-medium opacity-70 hover:opacity-100"
                      >
                        Later
                      </button>
                    )}
                  </div>
                )}
                <Outlet context={{ query, pending2fa }} />
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
