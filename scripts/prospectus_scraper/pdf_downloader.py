import hashlib
import os
import httpx

from config import PROSPECTUS_URL_TEMPLATE, PDF_CACHE_DIR

os.makedirs(PDF_CACHE_DIR, exist_ok=True)


from playwright.sync_api import sync_playwright

def download_prospectus(ipo_id: str) -> bytes:
    url = PROSPECTUS_URL_TEMPLATE.format(id=ipo_id)
    print(f"[DOWNLOAD] Downloading prospectus for ipo_id={ipo_id} from {url}...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        )
        page = context.new_page()
        # Visit detail page first to establish cookies & referer
        detail_url = f"https://e-ipo.co.id/id/ipo/{ipo_id}/"
        try:
            page.goto(detail_url, wait_until="domcontentloaded", timeout=20000)
            page.wait_for_timeout(1500)
            
            # Fetch prospectus bytes inside browser page context
            body_arr = page.evaluate(f"""
                async () => {{
                    const r = await fetch('{url}', {{credentials: 'include'}});
                    if (r.status !== 200) {{
                        throw new Error('HTTP Status ' + r.status);
                    }}
                    const buf = await r.arrayBuffer();
                    return Array.from(new Uint8Array(buf));
                }}
            """)
        finally:
            browser.close()
            
    pdf_bytes = bytes(body_arr)
    if len(pdf_bytes) < 10000:
        raise ValueError(
            f"Response untuk ipo_id={ipo_id} terlalu kecil ({len(pdf_bytes)} bytes). "
            f"Kemungkinan dokumen tidak valid atau kosong."
        )
    return pdf_bytes


def compute_hash(pdf_bytes: bytes) -> str:
    return hashlib.sha256(pdf_bytes).hexdigest()


def has_document_changed(ipo_id: str, new_hash: str) -> bool:
    """Bandingkan dengan hash yang tersimpan dari fetch sebelumnya."""
    cache_path = os.path.join(PDF_CACHE_DIR, f"{ipo_id}.hash")
    if not os.path.exists(cache_path):
        return True
    with open(cache_path, "r") as f:
        old_hash = f.read().strip()
    return old_hash != new_hash


def save_hash(ipo_id: str, new_hash: str) -> None:
    cache_path = os.path.join(PDF_CACHE_DIR, f"{ipo_id}.hash")
    with open(cache_path, "w") as f:
        f.write(new_hash)


def fetch_if_changed(ipo_id: str) -> tuple[bytes | None, str]:
    """
    Return (pdf_bytes, hash). pdf_bytes bernilai None jika dokumen
    tidak berubah sejak fetch terakhir -> caller harus skip parsing.
    """
    pdf_bytes = download_prospectus(ipo_id)
    new_hash = compute_hash(pdf_bytes)

    if not has_document_changed(ipo_id, new_hash):
        return None, new_hash

    save_hash(ipo_id, new_hash)
    return pdf_bytes, new_hash
