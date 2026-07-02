"""
Ekstraksi status emiten dari badge resmi e-IPO (DOM).
Satu fungsi dipakai untuk card homepage dan halaman detail.
"""

from playwright.sync_api import Page

VALID_STATUSES = {
    "book building",
    "waiting for offering",
    "offering",
    "pre-effective",
    "listed",
    "closed",
    "canceled",
    "postpone",
}

STATUS_LINE_KEYWORDS: list[tuple[str, str]] = [
    ("penawaran umum", "offering"),
    ("offering", "offering"),
    ("penawaran awal", "book building"),
    ("book building", "book building"),
    ("menunggu penawaran", "waiting for offering"),
    ("waiting for offering", "waiting for offering"),
    ("waiting for offer", "waiting for offering"),
    ("penjatahan", "waiting for offering"),
    ("tercatat", "listed"),
    ("listed", "listed"),
    ("closed", "listed"),
    ("dibatalkan", "canceled"),
    ("canceled", "canceled"),
    ("ditunda", "postpone"),
    ("postpone", "postpone"),
    ("pre-effective", "pre-effective"),
    ("pra-efektif", "pre-effective"),
]

_EXTRACT_STATUS_JS = """
(rootSelector) => {
  const KEYWORDS = [
    ['penawaran umum', 'offering'],
    ['offering', 'offering'],
    ['penawaran awal', 'book building'],
    ['book building', 'book building'],
    ['menunggu penawaran', 'waiting for offering'],
    ['waiting for offering', 'waiting for offering'],
    ['waiting for offer', 'waiting for offering'],
    ['penjatahan', 'waiting for offering'],
    ['tercatat', 'listed'],
    ['listed', 'listed'],
    ['closed', 'listed'],
    ['dibatalkan', 'canceled'],
    ['canceled', 'canceled'],
    ['ditunda', 'postpone'],
    ['postpone', 'postpone'],
    ['pre-effective', 'pre-effective'],
    ['pra-efektif', 'pre-effective'],
  ];

  const matchLine = (line) => {
    const trimmed = (line || '').trim();
    if (!trimmed || trimmed.length > 50) return null;
    const lower = trimmed.toLowerCase();
    for (const [keyword, status] of KEYWORDS) {
      if (lower === keyword) return status;
    }
    for (const [keyword, status] of KEYWORDS) {
      if (lower.includes(keyword) && lower.length <= 30) return status;
    }
    return null;
  };

  const scanRoot = (root) => {
    if (!root) return null;

    // 1. Cek seluruh baris text di container terlebih dahulu
    const lines = (root.innerText || '').split('\\n').map((s) => s.trim()).filter(Boolean);
    for (let i = 0; i < Math.min(lines.length, 35); i++) {
      const matched = matchLine(lines[i]);
      if (matched) return { raw: lines[i], status: matched };
    }

    // 2. Fallback: cari lewat selector jika ada badge khusus
    const badgeSelectors = [
      '.badge',
      '[class*="badge"]',
      '[class*="status"]',
      '[class*="label"]',
      'span.rounded-pill',
      'span.rounded-full',
    ];
    for (const selector of badgeSelectors) {
      for (const el of root.querySelectorAll(selector)) {
        const matched = matchLine(el.textContent);
        if (matched) return { raw: el.textContent.trim(), status: matched };
      }
    }

    return null;
  };

  if (rootSelector) {
    for (const el of document.querySelectorAll(rootSelector)) {
      const cardRoot = el.closest('.pricing-box') || el.closest('.card') || el.closest('[class*="card"]') || el.closest('[class*="pricing"]') || el.parentElement.parentElement || el.parentElement;
      const matched = scanRoot(cardRoot || el);
      if (matched) return matched;
    }
    return null;
  }

  return scanRoot(document.body);
}
"""


def normalize_status(raw_status: str) -> str:
    raw = raw_status.strip().lower()
    for keyword, status in STATUS_LINE_KEYWORDS:
        if keyword in raw:
            return status
    if "book" in raw:
        return "book building"
    if "waiting" in raw:
        return "waiting for offering"
    if "offer" in raw:
        return "offering"
    if "listed" in raw or "closed" in raw or "tercatat" in raw:
        return "listed"
    return "pre-effective"


def extract_status_from_page(page: Page, *, root_selector: str | None = None) -> str:
    """
    Ambil status dari badge/label resmi e-IPO di halaman yang sedang aktif.
    root_selector opsional: batasi pencarian ke card homepage.
    """
    result = page.evaluate(_EXTRACT_STATUS_JS, root_selector)
    if isinstance(result, dict) and result.get("status") in VALID_STATUSES:
        return result["status"]
    return "pre-effective"
