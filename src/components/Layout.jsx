import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  OverviewIcon, BatchesIcon, SalesIcon, LoansIcon,
  ExpendituresIcon, WithdrawalsIcon, SecurityIcon, SunIcon,
  MoonIcon, SearchIcon, LogoutIcon, MenuIcon, DownloadIcon,
} from './icons.jsx';
import { exportSales } from '../lib/api';
import { useAuth } from '../lib/useAuth.jsx';

const links = [
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
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
        {links.map(({ to, label, end, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}
          >
            <span className="side-icon"><Icon className="w-[18px] h-[18px]" /></span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-4">
        <div className="integrate-card">
          <p className="text-[13px] font-bold leading-snug">Sales Excel report</p>
          <p className="text-[12px] opacity-70 mt-0.5 leading-snug">Download all sales as an .xlsx Excel document for your records or accountant.</p>
          <button onClick={handleDownload} disabled={downloading} className="details-btn download-btn">
            <DownloadIcon className="w-3.5 h-3.5" />
            {downloading ? 'Preparing…' : 'Download'}
          </button>
        </div>
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
                placeholder="Search transactions…"
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
            <Outlet context={{ query }} />
          </main>
        </div>
      </div>
    </div>
  );
}
