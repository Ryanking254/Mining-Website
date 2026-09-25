/**
 * Authenticator (TOTP) grace-period helpers — frontend mirror of the backend
 * policy in Mining-backend/src/utils.js.
 *
 * Policy: the authenticator app is optional for TWOFA_GRACE_DAYS after account
 * creation (reminders shown), then compulsory. It can never be disabled.
 * If you change the grace length, change it in both places:
 * backend TWOFA_GRACE_DAYS env and VITE_TWOFA_GRACE_DAYS here.
 */
export const TWOFA_GRACE_DAYS = Number(import.meta.env.VITE_TWOFA_GRACE_DAYS ?? 7) || 7;

function parseDate(v) {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const s = String(v).trim();
  let d = new Date(s);
  if (Number.isNaN(d.getTime()) && s.includes(' ')) {
    d = new Date(s.replace(' ', 'T'));
  }
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Returns { enabled, required, graceDays, deadline, daysLeft, overdue }
 * for a user object ({ twofaEnabled, createdAt }).
 */
export function getTwofaState(user, now = new Date()) {
  const enabled = !!user?.twofaEnabled;
  if (enabled) {
    return { enabled: true, required: false, graceDays: TWOFA_GRACE_DAYS, deadline: null, daysLeft: 0, overdue: false };
  }
  const created = parseDate(user?.createdAt);
  const deadline = created ? new Date(created.getTime() + TWOFA_GRACE_DAYS * 86400000) : null;
  const daysLeft = deadline ? Math.ceil((deadline.getTime() - now.getTime()) / 86400000) : TWOFA_GRACE_DAYS;
  return {
    enabled: false,
    required: true,
    graceDays: TWOFA_GRACE_DAYS,
    deadline,
    daysLeft: Math.max(daysLeft, 0),
    overdue: deadline ? now.getTime() > deadline.getTime() : false,
  };
}
