/**
 * Small formatting helpers shared by the dashboard analytics widgets.
 *
 * All functions are SSR-safe (no `window`, no `Intl` configuration that
 * depends on browser state). Outputs are Persian by default.
 */

/**
 * Convert a duration in seconds to a Persian-friendly compact string.
 *
 *   ۱۲ ثانیه
 *   ۲ دقیقه و ۳۰ ثانیه
 *   ۱ ساعت و ۵ دقیقه
 *   ۲ ساعت و ۰ دقیقه (we keep the minute slot to read naturally)
 *
 * Returns "—" for null/undefined/NaN.
 */
export function formatDurationFa(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) {
    return '—';
  }
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) return `${toFa(h)} ساعت و ${toFa(m)} دقیقه`;
  if (m > 0) return `${toFa(m)} دقیقه و ${toFa(s)} ثانیه`;
  return `${toFa(s)} ثانیه`;
}

/**
 * Short, table-friendly Persian duration formatter for attendance rows.
 * Always returns "Hح:Mد" / "Mد Sث" / "Sث" so columns stay aligned.
 */
export function formatDurationCompactFa(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return '—';
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${toFa(h)}:${pad(m)}:${pad(s)}`;
  return `${toFa(m)}:${pad(s)}`;
}

/** Format an ISO timestamp as "YYYY/MM/DD HH:mm" in fa-IR; "—" for null. */
export function formatDateTimeFa(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

/** Format an ISO date as Persian short date; "—" for null. */
export function formatDateFa(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('fa-IR');
  } catch {
    return '—';
  }
}

/** Western digits → Persian digits. Used by all the helpers above. */
export function toFa(n: number | string): string {
  const map = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/\d/g, (d) => map[Number(d)]);
}

function pad(n: number): string {
  return toFa(String(n).padStart(2, '0'));
}
