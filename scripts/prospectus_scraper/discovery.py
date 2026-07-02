"""
Discovery module untuk e-IPO.
Mengambil daftar emiten dan status tahapan IPO dari homepage e-IPO serta halaman detail.
"""

import re
import time
from dataclasses import dataclass

from playwright.sync_api import Page, sync_playwright

from config import BASE_URL, BROWSER_USER_AGENT, HOME_URL, PLAYWRIGHT_HEADLESS
from status import extract_status_from_page, normalize_status


@dataclass
class EmitenSummary:
    ipo_id: str
    slug: str
    ticker: str
    nama: str
    logo_url: str | None
    status: str
    sector: str | None = None
    website: str | None = None
    underwriters: str | None = None
    price: int | None = None
    offered_shares: int | None = None
    public_float_pct: float | None = None
    bb_price_low: int | None = None
    bb_price_high: int | None = None
    bb_open: str | None = None
    bb_close: str | None = None
    offering_open: str | None = None
    offering_close: str | None = None
    distribution_date: str | None = None
    listing_date: str | None = None


def _parse_ipo_url(href: str) -> tuple[str, str] | None:
    match = re.search(r"/id/ipo/(\d+)/([a-z0-9\-]+)", href)
    if not match:
        return None
    return match.group(1), match.group(2)


def _resolve_detail_url(url_or_slug: str) -> str | None:
    if url_or_slug.startswith("http"):
        url = url_or_slug
    elif url_or_slug.startswith("/"):
        url = f"{BASE_URL}{url_or_slug}"
    else:
        url = f"{BASE_URL}/id/ipo/{url_or_slug}"
    return url if _parse_ipo_url(url) else None


def _parse_date_id(date_str: str) -> str | None:
    if not date_str:
        return None
    months = {
        "jan": "01", "feb": "02", "mar": "03", "apr": "04", "mei": "05", "may": "05",
        "jun": "06", "jul": "07", "agu": "08", "aug": "08", "sep": "09", "okt": "10",
        "oct": "10", "nov": "11", "des": "12", "dec": "12",
    }
    match = re.search(r"(\d{1,2})\s+([a-zA-Z]{3})\s+(\d{4})", date_str)
    if match:
        day = match.group(1).zfill(2)
        month_str = match.group(2).lower()[:3]
        year = match.group(3)
        month = months.get(month_str, "01")
        return f"{year}-{month}-{day}"
    return None


def _parse_number(num_str: str) -> int | None:
    if not num_str:
        return None
    clean = re.sub(r"[^\d]", "", num_str)
    return int(clean) if clean else None


def _parse_float(num_str: str) -> float | None:
    if not num_str:
        return None
    clean = num_str.replace(",", ".").strip()
    match = re.search(r"([\d\.]+)", clean)
    return float(match.group(1)) if match else None


def _parse_detail_from_text(text: str, url: str, *, status: str) -> EmitenSummary | None:
    parsed = _parse_ipo_url(url)
    if not parsed:
        return None
    ipo_id, slug = parsed

    ticker_match = re.search(r"Kode Emiten\n+\s*([A-Z0-9]+)", text, re.I)
    ticker = ticker_match.group(1).strip() if ticker_match else slug.split("-")[0].upper()

    breadcrumb_match = re.search(r"beranda\s+ipo\s+\[[A-Z0-9]+\]\s+([^\n\r]+)", text, re.I)
    if breadcrumb_match:
        nama = breadcrumb_match.group(1).strip()
    else:
        pt_match = re.search(r"(PT\s+[A-Za-z\s]+Tbk)", text, re.I)
        nama = pt_match.group(1).strip() if pt_match else slug.replace("-", " ").title()
    if not nama or "Beranda" in nama or len(nama) < 5:
        pt_match = re.search(r"(PT\s+[A-Za-z\s]+Tbk)", text, re.I)
        if pt_match:
            nama = pt_match.group(1).strip()

    sector_match = re.search(r"Sektor\n+\s*([^\n]+)", text, re.I)
    sector = sector_match.group(1).strip() if sector_match else None

    web_match = re.search(r"Situs Perusahaan Emiten\n+\s*(https?://[^\s]+)", text, re.I)
    website = web_match.group(1).strip() if web_match else None

    shares_match = re.search(r"Jumlah Saham Ditawarkan\n+\s*([\d\.]+)", text, re.I)
    offered_shares = _parse_number(shares_match.group(1)) if shares_match else None

    float_match = re.search(r"%\s*dari\s*Total\s*Saham\s*Dicatatkan\n+\s*([\d\.,]+)", text, re.I)
    public_float_pct = _parse_float(float_match.group(1)) if float_match else None

    und_match = re.search(r"Penjamin Emisi Efek\n+\s*([^\n]+)", text, re.I)
    underwriters = und_match.group(1).strip() if und_match else None

    bb_low, bb_high, bb_open, bb_close = None, None, None, None
    bb_match = re.search(
        r"Book Building\n+\s*(\d{1,2}\s+\w{3}\s+\d{4})\s*-\s*(\d{1,2}\s+\w{3}\s+\d{4})\n+\s*Rp\s*([\d\.]+)\s*-\s*Rp\s*([\d\.]+)",
        text,
        re.I,
    )
    if bb_match:
        bb_open = _parse_date_id(bb_match.group(1))
        bb_close = _parse_date_id(bb_match.group(2))
        bb_low = _parse_number(bb_match.group(3))
        bb_high = _parse_number(bb_match.group(4))

    offering_open, offering_close, price = None, None, None
    off_match = re.search(
        r"Penawaran Umum\n+\s*(\d{1,2}\s+\w{3}\s+\d{4})\s*-\s*(\d{1,2}\s+\w{3}\s+\d{4})\n+\s*Rp\s*([\d\.]+)",
        text,
        re.I,
    )
    if off_match:
        offering_open = _parse_date_id(off_match.group(1))
        offering_close = _parse_date_id(off_match.group(2))
        price = _parse_number(off_match.group(3))

    dist_match = re.search(r"Distribusi\n+\s*(\d{1,2}\s+\w{3}\s+\d{4})", text, re.I)
    distribution_date = _parse_date_id(dist_match.group(1)) if dist_match else None

    list_match = re.search(r"Tanggal Pencatatan\n+\s*(\d{1,2}\s+\w{3}\s+\d{4})", text, re.I)
    listing_date = _parse_date_id(list_match.group(1)) if list_match else None

    logo_url = f"{BASE_URL}/id/pipeline/get-logo?id={ipo_id}"

    return EmitenSummary(
        ipo_id=ipo_id,
        slug=slug,
        ticker=ticker,
        nama=nama,
        logo_url=logo_url,
        status=normalize_status(status),
        sector=sector,
        website=website,
        underwriters=underwriters,
        price=price,
        offered_shares=offered_shares,
        public_float_pct=public_float_pct,
        bb_price_low=bb_low,
        bb_price_high=bb_high,
        bb_open=bb_open,
        bb_close=bb_close,
        offering_open=offering_open,
        offering_close=offering_close,
        distribution_date=distribution_date,
        listing_date=listing_date,
    )


class EipoScraperSession:
    """Satu sesi Playwright untuk homepage, detail emiten, dan download PDF."""

    def __init__(self, headless: bool | None = None):
        self._headless = PLAYWRIGHT_HEADLESS if headless is None else headless
        self._playwright = None
        self._browser = None
        self._page: Page | None = None

    def __enter__(self) -> "EipoScraperSession":
        self._playwright = sync_playwright().start()
        self._browser = self._playwright.chromium.launch(headless=self._headless)
        self._page = self._browser.new_page(user_agent=BROWSER_USER_AGENT)
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        if self._browser:
            self._browser.close()
        if self._playwright:
            self._playwright.stop()

    @property
    def page(self) -> Page:
        if self._page is None:
            raise RuntimeError("Browser session belum dibuka.")
        return self._page

    def _load_page(self, url: str, retries: int = 3) -> bool:
        for attempt in range(1, retries + 1):
            try:
                self.page.goto(url, wait_until="domcontentloaded", timeout=45000)
                self.page.wait_for_timeout(1500)
                return True
            except Exception as e:
                print(f"[WARNING] Gagal membuka halaman {url} (Percobaan {attempt}/{retries}): {e}")
                if attempt < retries:
                    time.sleep(2 * attempt)
        print(f"[ERROR] Gagal membuka halaman {url} setelah {retries} percobaan.")
        return False

    def scrape_detail(self, url_or_slug: str, status: str | None = None) -> EmitenSummary | None:
        url = _resolve_detail_url(url_or_slug)
        if not url:
            return None
        if not self._load_page(url):
            return None

        if status is None:
            status = extract_status_from_page(self.page)
        text = self.page.locator("body").inner_text()
        return _parse_detail_from_text(text, url, status=status)

    def scrape_all(self) -> list[EmitenSummary]:
        """Scrape homepage lalu semua halaman detail dalam satu sesi browser."""
        results: list[EmitenSummary] = []

        print(f"[DISCOVERY] Membuka homepage ({HOME_URL}) headless={self._headless}...")
        if not self._load_page(HOME_URL):
            return results

        links: list[str] = []
        for anchor in self.page.locator("a").all():
            href = anchor.get_attribute("href") or ""
            if "/id/ipo/" in href and "index" not in href:
                if href.startswith("/"):
                    href = f"{BASE_URL}{href}"
                links.append(href)

        unique_links = sorted(set(links))
        print(f"[DISCOVERY] Ditemukan {len(unique_links)} halaman detail emiten.")

        # 1. Ambil status emiten dari homepage untuk setiap unique link
        status_by_ipo_id: dict[str, str] = {}
        for link in unique_links:
            parsed = _parse_ipo_url(link)
            if parsed:
                ipo_id = parsed[0]
                selector = f'a[href*="/id/ipo/{ipo_id}/"]'
                status_by_ipo_id[ipo_id] = extract_status_from_page(self.page, root_selector=selector)

        # 2. Proses detail emiten dengan status homepage
        for i, link in enumerate(unique_links, start=1):
            parsed = _parse_ipo_url(link)
            ipo_id = parsed[0] if parsed else ""
            status = status_by_ipo_id.get(ipo_id)
            print(f"[DISCOVERY] ({i}/{len(unique_links)}) {link} [Homepage Status: {status}]")
            summary = self.scrape_detail(link, status=status)
            if summary:
                results.append(summary)

        return results


def scrape_detail_page(url_or_slug: str, *, headless: bool | None = None) -> EmitenSummary | None:
    """Scrape satu halaman detail (untuk skrip test). Membuka sesi browser sendiri."""
    with EipoScraperSession(headless=headless) as session:
        return session.scrape_detail(url_or_slug)


def scrape_homepage() -> list[EmitenSummary]:
    """Scrape seluruh emiten dari homepage dalam satu sesi browser."""
    with EipoScraperSession() as session:
        return session.scrape_all()
