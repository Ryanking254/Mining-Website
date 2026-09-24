// Central SVG icon set — stroke style, 1.8px, round caps.
// All icons accept className for sizing/color.

function base(props, children) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function OverviewIcon(props) {
  return base(
    props,
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.8" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8" />
    </>
  );
}

export function BatchesIcon(props) {
  // stacked layers / package
  return base(
    props,
    <>
      <path d="M12 2.5 21 7.5l-9 5-9-5 9-5Z" />
      <path d="m3.5 12 8.5 4.7L20.5 12" />
      <path d="m3.5 16.5 8.5 4.7 8.5-4.7" />
    </>
  );
}

export function SalesIcon(props) {
  // two-way trade arrows in a circle-ish flow
  return base(
    props,
    <>
      <path d="M7 4 3.5 7.5 7 11" />
      <path d="M3.5 7.5H16" />
      <path d="m17 13 3.5 3.5L17 20" />
      <path d="M20.5 16.5H8" />
    </>
  );
}

export function LoansIcon(props) {
  // coin stack with hand / giving — coins + outstretched hand
  return base(
    props,
    <>
      <ellipse cx="9" cy="6" rx="5.5" ry="2.5" />
      <path d="M3.5 6v5c0 1.38 2.46 2.5 5.5 2.5s5.5-1.12 5.5-2.5V6" />
      <path d="M3.5 11v5c0 1.38 2.46 2.5 5.5 2.5 1.9 0 3.57-.44 4.6-1.12" />
      <path d="M15.5 14.5h4.2a1.5 1.5 0 0 1 0 3H17l-1.8 1.8a1.4 1.4 0 0 1-2-2L14.5 16" />
    </>
  );
}

export function ExpendituresIcon(props) {
  // receipt with down-trend
  return base(
    props,
    <>
      <path d="M6 2.5h12V21l-2.6-1.6L12.8 21l-2.6-1.6L7.6 21 6 19.9V2.5Z" />
      <path d="M9 7.5h6" />
      <path d="m10.5 12 1.5 1.5 2.5-3" />
    </>
  );
}

export function WithdrawalsIcon(props) {
  // wallet with up-right out arrow
  return base(
    props,
    <>
      <path d="M19 7V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1" />
      <path d="M3 6.5h12a2 2 0 0 1 2 2V10H5" />
      <circle cx="16.5" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
      <path d="M19 14.5h.01" />
    </>
  );
}

export function BellIcon(props) {
  return base(
    props,
    <>
      <path d="M18 8.5a6 6 0 1 0-12 0c0 6.5-2.7 8-2.7 8h17.4s-2.7-1.5-2.7-8" />
      <path d="M13.7 20.5a2 2 0 0 1-3.4 0" />
    </>
  );
}

export function SunIcon(props) {
  return base(
    props,
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  );
}

export function MoonIcon(props) {
  return base(
    props,
    <>
      <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
    </>
  );
}

export function SearchIcon(props) {
  return base(
    props,
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.8-3.8" />
    </>
  );
}

export function LogoutIcon(props) {
  return base(
    props,
    <>
      <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </>
  );
}

export function MenuIcon(props) {
  return base(
    props,
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </>
  );
}

export function DownloadIcon(props) {
  return base(
    props,
    <>
      <path d="M12 3.5V15" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
      <path d="M4 19.5h16" />
    </>
  );
}
