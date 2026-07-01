export const IPO_STATUS_LABEL: Record<string, string> = {
  'book building': 'Book Building',
  'waiting for offering': 'Waiting Offer',
  'offering': 'Offering',
  'pre-effective': 'Pre-Effective',
  'listed': 'Listed',
  'closed': 'Listed',
  'canceled': 'Canceled',
  'postpone': 'Postponed',
};

export function normalizeIpoStatus(raw: string | null | undefined): string {
  const value = (raw || 'pre-effective').toLowerCase().replace(/_/g, ' ').trim();
  if (value in IPO_STATUS_LABEL) return value;
  if (value.includes('book')) return 'book building';
  if (value.includes('waiting')) return 'waiting for offering';
  if (value.includes('offer') || value.includes('penawaran umum')) return 'offering';
  if (value.includes('listed') || value.includes('tercatat') || value === 'closed') return 'listed';
  if (value.includes('cancel')) return 'canceled';
  if (value.includes('postpone') || value.includes('tunda')) return 'postpone';
  return 'pre-effective';
}

/** Satu sumber status untuk card, filter, dan halaman detail: nilai dari database. */
export function getIpoStatus(ipo: { status?: string | null }): string {
  return normalizeIpoStatus(ipo.status);
}

export function getIpoStatusLabel(status: string): string {
  return IPO_STATUS_LABEL[status] || status.replace(/\b\w/g, (c) => c.toUpperCase());
}
