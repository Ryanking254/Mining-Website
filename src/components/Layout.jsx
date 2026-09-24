import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  OverviewIcon, BatchesIcon, SalesIcon, LoansIcon,
  ExpendituresIcon, WithdrawalsIcon, BellIcon, SunIcon,
  MoonIcon, SearchIcon, LogoutIcon, MenuIcon, DownloadIcon,
} from './icons.jsx';
import { exportSales } from '../lib/api';

const links = [
  { to: '/', label: 'Overview', end: true, Icon: OverviewIcon },
  { to: '/batches', label: 'Batches', Icon: BatchesIcon },
  { to: '/sales', label: 'Sales', Icon: SalesIcon },
  { to: '/loans', label: 'Loans', Icon: LoansIcon },
  { to: '/expenditures', label: 'Expenditures', Icon: ExpendituresIcon },
  { to: '/withdrawals', label: 'Withdrawals', Icon: WithdrawalsIcon },
];

const metals = [
  { name: 'Gold', ticker: 'XAU', price: '$2,912', delta: '+2.43%', up: true, dot: '#C9A227' },
  { name: 'Silver', ticker: 'XAG', price: '$34.20', delta: '-0.70%', up: false, dot: '#9AA3B2' },
  { name: 'Copper', ticker: 'HG', price: '$4.52', delta: '+3.12%', up: true, dot: '#E8620C' },
  { name: 'Coltan', ticker: 'COL', price: '$68.10', delta: '-2.56%', up: false, dot: '#5C5C5C' },
];

const notifications = [
  { title: 'Sale recorded', body: 'Batch B-104 · 12.4g sold', time: '2m ago', unread: true },
  { title: 'Loan repayment', body: 'K. Mwangi repaid KES 8,000', time: '1h ago', unread: true },
  { title: 'Low stock', body: 'Batch B-101 under 20% remaining', time: '3h ago', unread: false },
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
  const [notifOpen, setNotifOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const notifRef = useRef(null);
  const unreadCount = notifications.filter((n) => n.unread).length;

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
    function onClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') { setNotifOpen(false); setMobileOpen(false); }
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
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

      <p className="side-label">Metals</p>
      <div className="flex flex-col gap-0.5 px-1">
        {metals.map((m) => (
          <div key={m.name} className="metal-row">
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-[3px] shrink-0" style={{ background: m.dot }} />
              <span className="font-medium truncate">{m.ticker}</span>
              <span className="metal-price tabular">{m.price}</span>
            </span>
            <span className={`text-[11px] tabular font-semibold ${m.up ? 'text-[#1F9D55]' : 'text-[#E5484D]'}`}>
              {m.delta}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-4">
        <div className="integrate-card">
          <p className="text-[13px] font-bold leading-snug">Sales Excel report</p>
          <p className="text-[12px] opacity-70 mt-0.5 leading-snug">Download all sales as an .xlsx Excel document for your records or accountant.</p>
          <button onClick={handleDownload} disabled={downloading} className="details-btn download-btn">
            <DownloadIcon className="w-3.5 h-3.5" />
            {downloading ? 'Preparing…' : 'Download'}
          </button>
        </div>
        <button className="side-link w-full text-left">
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

              <div className="relative" ref={notifRef}>
                <button
                  className="icon-btn relative"
                  title="Notifications"
                  aria-label="Notifications"
                  aria-expanded={notifOpen}
                  onClick={() => setNotifOpen((v) => !v)}
                >
                  <BellIcon className="w-[18px] h-[18px]" />
                  {unreadCount > 0 && <span className="notif-dot" />}
                </button>
                {notifOpen && (
                  <div className="notif-pop">
                    <div className="flex items-center justify-between px-3.5 py-3 border-b border-[#F1EDE2]">
                      <p className="text-[13px] font-bold">Notifications</p>
                      <span className="badge badge-orange">{unreadCount} new</span>
                    </div>
                    <div className="max-h-[320px] overflow-y-auto">
                      {notifications.map((n, i) => (
                        <div key={i} className="notif-item">
                          <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.unread ? 'bg-[#E8620C]' : 'bg-[#E3DCCB]'}`} />
                          <span className="min-w-0">
                            <span className="block text-[13px] font-semibold">{n.title}</span>
                            <span className="block text-[12px] text-[#8A8A8A] truncate">{n.body}</span>
                            <span className="block text-[11px] text-[#B0A893] mt-0.5">{n.time}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="user-chip">
                <div className="user-avatar">A</div>
                <span className="text-[13px] font-medium hidden md:block">Alexander</span>
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
