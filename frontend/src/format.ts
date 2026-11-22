export function inr(n: number | null | undefined, compact = false): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(n)
  if (compact && Math.abs(n) >= 100000) return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, notation: 'compact' }).format(n)
  return '₹' + formatted
}

export function pct(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : n.toFixed(2) + '%'
}

export function ddmmyyyy(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}-${m}-${y}`
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const monthLabel = (y: number, m: number) => `${MONTHS[m - 1]} ${y}`
