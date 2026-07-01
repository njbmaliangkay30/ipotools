"""
Discovery module untuk e-IPO.
Mengambil daftar emiten dan status tahapan IPO dari homepage e-IPO serta halaman detail.
"""

import re
from dataclasses import dataclass
from playwright.sync_api import sync_playwright

from config import HOME_URL

VALID_STATUSES = {"book building", "waiting for offering", "offering", "pre-effective", "listed", "closed"}


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


def _normalize_status(raw_status: str) -> str:
    raw = raw_status.strip().lower()
    if "book" in raw:
        return "book building"
    if "waiting" in raw:
        return "waiting for offering"
    if "offer" in raw or "penawaran umum" in raw:
        return "offering"
    if "listed" in raw or "closed" in raw or "tercatat" in raw:
        return "listed"
    return "pre-effective"


def _parse_date_id(date_str: str) -> str | None:
    if not date_str:
        return None
    months = {
        "jan": "01", "feb": "02", "mar": "03", "apr": "04", "mei": "05", "may": "05",
        "jun": "06", "jul": "07", "agu": "08", "aug": "08", "sep": "09", "okt": "10",
        "oct": "10", "nov": "11", "des": "12", "dec": "12"
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


def scrape_detail_page(url_or_slug: str) -> EmitenSummary | None:
    """
    Scrape informasi lengkap dari halaman detail IPO (misal: /id/ipo/349/jeli-pt-niramas-utama-tbk)
    menggunakan Playwright dalam headful mode agar terhindar dari blokir Cloudflare.
    """
    if not url_or_slug.startswith("http"):
        if url_or_slug.startswith("/"):
            url = f"https://e-ipo.co.id{url_or_slug}"
        else:
            url = f"https://e-ipo.co.id/id/ipo/{url_or_slug}"
    else:
        url = url_or_slug

    parsed = _parse_ipo_url(url)
    if not parsed:
        return None
    ipo_id, slug = parsed

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(2000)
            text = page.locator("body").inner_text()
        except Exception as e:
            print(f"[ERROR] Gagal membuka halaman {url}: {e}")
            browser.close()
            return None

        # Ticker
        ticker_match = re.search(r"Kode Emiten\n+\s*([A-Z0-9]+)", text, re.I)
        ticker = ticker_match.group(1).strip() if ticker_match else slug.split("-")[0].upper()

        # Nama PT - ambil dari breadcrumb atau langsung dari teks
        # Breadcrumb pola: "beranda ipo [JELI] PT Niramas Utama Tbk"
        breadcrumb_match = re.search(r"beranda\s+ipo\s+\[[A-Z0-9]+\]\s+([^\n\r]+)", text, re.I)
        if breadcrumb_match:
            nama = breadcrumb_match.group(1).strip()
        else:
            # Fallback: ambil nama PT langsung dari teks halaman
            pt_match = re.search(r"(PT\s+[A-Za-z\s]+Tbk)", text, re.I)
            nama = pt_match.group(1).strip() if pt_match else slug.replace("-", " ").title()
        # Sanitasi jika masih berisi teks navigasi
        if not nama or "Beranda" in nama or len(nama) < 5:
            pt_match = re.search(r"(PT\s+[A-Za-z\s]+Tbk)", text, re.I)
            if pt_match:
                nama = pt_match.group(1).strip()

        # Sektor
        sector_match = re.search(r"Sektor\n+\s*([^\n]+)", text, re.I)
        sector = sector_match.group(1).strip() if sector_match else None

        # Website
        web_match = re.search(r"Situs Perusahaan Emiten\n+\s*(https?://[^\s]+)", text, re.I)
        website = web_match.group(1).strip() if web_match else None

        # Saham ditawarkan
        shares_match = re.search(r"Jumlah Saham Ditawarkan\n+\s*([\d\.]+)", text, re.I)
        offered_shares = _parse_number(shares_match.group(1)) if shares_match else None

        # Public float
        float_match = re.search(r"%\s*dari\s*Total\s*Saham\s*Dicatatkan\n+\s*([\d\.,]+)", text, re.I)
        public_float_pct = _parse_float(float_match.group(1)) if float_match else None

        # Underwriters
        und_match = re.search(r"Penjamin Emisi Efek\n+\s*([^\n]+)", text, re.I)
        underwriters = und_match.group(1).strip() if und_match else None

        # Book Building
        bb_low, bb_high, bb_open, bb_close = None, None, None, None
        bb_match = re.search(r"Book Building\n+\s*(\d{1,2}\s+\w{3}\s+\d{4})\s*-\s*(\d{1,2}\s+\w{3}\s+\d{4})\n+\s*Rp\s*([\d\.]+)\s*-\s*Rp\s*([\d\.]+)", text, re.I)
        if bb_match:
            bb_open = _parse_date_id(bb_match.group(1))
            bb_close = _parse_date_id(bb_match.group(2))
            bb_low = _parse_number(bb_match.group(3))
            bb_high = _parse_number(bb_match.group(4))

        # Penawaran Umum (Offering)
        offering_open, offering_close, price = None, None, None
        off_match = re.search(r"Penawaran Umum\n+\s*(\d{1,2}\s+\w{3}\s+\d{4})\s*-\s*(\d{1,2}\s+\w{3}\s+\d{4})\n+\s*Rp\s*([\d\.]+)", text, re.I)
        if off_match:
            offering_open = _parse_date_id(off_match.group(1))
            offering_close = _parse_date_id(off_match.group(2))
            price = _parse_number(off_match.group(3))

        # Distribusi & Pencatatan
        dist_match = re.search(r"Distribusi\n+\s*(\d{1,2}\s+\w{3}\s+\d{4})", text, re.I)
        distribution_date = _parse_date_id(dist_match.group(1)) if dist_match else None

        list_match = re.search(r"Tanggal Pencatatan\n+\s*(\d{1,2}\s+\w{3}\s+\d{4})", text, re.I)
        listing_date = _parse_date_id(list_match.group(1)) if list_match else None

        # Status penentuan
        status = "pre-effective"
        if "offering" in text.lower() or "penawaran umum" in text.lower():
            if price:
                status = "offering"
        elif "book building" in text.lower() and bb_high:
            status = "book building"
        elif "tercatat" in text.lower() or "listed" in text.lower():
            status = "listed"

        logo_url = f"https://e-ipo.co.id/id/pipeline/get-logo?id={ipo_id}"

        browser.close()

        return EmitenSummary(
            ipo_id=ipo_id,
            slug=slug,
            ticker=ticker,
            nama=nama,
            logo_url=logo_url,
            status=status,
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


def scrape_homepage() -> list[EmitenSummary]:
    """
    Scrape daftar emiten dari /id/home e-IPO menggunakan Playwright dalam headful mode.
    """
    results: list[EmitenSummary] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto("https://e-ipo.co.id/id/home", wait_until="domcontentloaded")
        page.wait_for_timeout(3000)

        links = []
        for a in page.locator("a").all():
            href = a.get_attribute("href") or ""
            if "/id/ipo/" in href and "index" not in href:
                links.append(href)

        browser.close()

    unique_links = sorted(list(set(links)))
    for link in unique_links:
        summary = scrape_detail_page(link)
        if summary:
            results.append(summary)

    return results
