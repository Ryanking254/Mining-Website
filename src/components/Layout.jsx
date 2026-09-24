import { NavLink, Outlet } from 'react-router-dom';

const links = [
  { to: '/', label: 'Capital', end: true },
  { to: '/batches', label: 'Batches' },
  { to: '/sales', label: 'Sales' },
  { to: '/loans', label: 'Loans' },
  { to: '/expenditures', label: 'Expenditures' },
  { to: '/withdrawals', label: 'Withdrawals' },
];

export default function Layout() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-48 shrink-0 border-r border-hair px-6 py-9 hidden md:block">
        <div className="font-display text-lg text-bone mb-12 tracking-tight">Ledger</div>
        <nav className="flex flex-col gap-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `nav-tick text-sm py-2 pl-4 transition-colors duration-150 ${
                  isActive ? 'active text-bone' : 'text-bonedim hover:text-bone'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 px-6 md:px-14 py-10 max-w-5xl">
        <Outlet />
      </main>
    </div>
  );
}
