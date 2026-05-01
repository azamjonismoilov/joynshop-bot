// Format helpers — narx, sana, raqam.

const UZ_MONTHS = [
  'Yanvar', 'Fevral', 'Mart',     'Aprel',  'May',     'Iyun',
  'Iyul',   'Avgust', 'Sentabr',  'Oktabr', 'Noyabr',  'Dekabr',
];

/** "1,200,000" — full price with thousand separators */
export function formatPrice(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '0';
  return Math.round(n).toLocaleString('en-US');
}

/** "1.4M" / "550K" / "999" — compact short form */
export function formatPriceShort(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '0';
  const v = Math.round(n);
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return Number.isInteger(m) ? `${m}M` : `${m.toFixed(1)}M`;
  }
  if (v >= 1_000) {
    return `${Math.floor(v / 1_000)}K`;
  }
  return String(v);
}

/** "1-May, 2026" — Uzbek long date */
export function formatDateUz(d: Date = new Date()): string {
  return `${d.getDate()}-${UZ_MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
}

/** "25/4" — short day/month for chart X-axis */
export function formatChartDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/** "Aziz Karimov" → "AK" — initials for Avatar */
export function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?';
}

/** Deterministic pastel color from string (avatar bg) */
export function colorFromName(name: string): { bg: string; fg: string } {
  if (!name) return { bg: 'hsl(0, 0%, 92%)', fg: 'hsl(0, 0%, 30%)' };
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return {
    bg: `hsl(${hue}, 65%, 92%)`,
    fg: `hsl(${hue}, 50%, 32%)`,
  };
}
