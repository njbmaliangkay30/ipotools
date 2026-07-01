import hashlib
import json
import os

from playwright.sync_api import Page, sync_playwright

from config import BASE_URL, BROWSER_USER_AGENT, PDF_CACHE_DIR, PLAYWRIGHT_HEADLESS, PROSPECTUS_URL_TEMPLATE

os.makedirs(PDF_CACHE_DIR, exist_ok=True)

MIN_PDF_BYTES = 10000


def _pdf_path(ipo_id: str) -> str:
    return os.path.join(PDF_CACHE_DIR, f"{ipo_id}.pdf")


def _meta_path(ipo_id: str) -> str:
    return os.path.join(PDF_CACHE_DIR, f"{ipo_id}.meta.json")


def _legacy_hash_path(ipo_id: str) -> str:
    return os.path.join(PDF_CACHE_DIR, f"{ipo_id}.hash")


def compute_hash(pdf_bytes: bytes) -> str:
    return hashlib.sha256(pdf_bytes).hexdigest()


def _load_cache_meta(ipo_id: str) -> dict | None:
    meta_file = _meta_path(ipo_id)
    if not os.path.exists(meta_file):
        legacy = _legacy_hash_path(ipo_id)
        if os.path.exists(legacy):
            with open(legacy, "r", encoding="utf-8") as f:
                return {"hash": f.read().strip()}
        return None
    with open(meta_file, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_cache(ipo_id: str, pdf_bytes: bytes, *, content_length: str | None = None, etag: str | None = None) -> str:
    pdf_hash = compute_hash(pdf_bytes)
    with open(_pdf_path(ipo_id), "wb") as f:
        f.write(pdf_bytes)

    meta = {
        "hash": pdf_hash,
        "size": len(pdf_bytes),
        "content_length": content_length,
        "etag": etag,
    }
    with open(_meta_path(ipo_id), "w", encoding="utf-8") as f:
        json.dump(meta, f)

    with open(_legacy_hash_path(ipo_id), "w", encoding="utf-8") as f:
        f.write(pdf_hash)

    return pdf_hash


def _validate_pdf_bytes(pdf_bytes: bytes, ipo_id: str) -> None:
    if len(pdf_bytes) < MIN_PDF_BYTES:
        raise ValueError(
            f"Response untuk ipo_id={ipo_id} terlalu kecil ({len(pdf_bytes)} bytes). "
            f"Kemungkinan dokumen tidak valid atau kosong."
        )


def _probe_remote_headers(page: Page, url: str) -> dict:
    return page.evaluate(
        """async (url) => {
            const r = await fetch(url, { method: 'HEAD', credentials: 'include' });
            return {
                ok: r.ok,
                status: r.status,
                etag: r.headers.get('etag'),
                content_length: r.headers.get('content-length'),
            };
        }""",
        url,
    )


def _fetch_pdf_via_page(page: Page, ipo_id: str, url: str) -> tuple[bytes, dict]:
    detail_url = f"{BASE_URL}/id/ipo/{ipo_id}/"
    page.goto(detail_url, wait_until="domcontentloaded", timeout=20000)
    page.wait_for_timeout(1000)

    result = page.evaluate(
        """async (url) => {
            const r = await fetch(url, { credentials: 'include' });
            if (!r.ok) {
                throw new Error('HTTP Status ' + r.status);
            }
            const buf = await r.arrayBuffer();
            return {
                bytes: Array.from(new Uint8Array(buf)),
                etag: r.headers.get('etag'),
                content_length: r.headers.get('content-length'),
            };
        }""",
        url,
    )
    pdf_bytes = bytes(result["bytes"])
    _validate_pdf_bytes(pdf_bytes, ipo_id)
    return pdf_bytes, {
        "etag": result.get("etag"),
        "content_length": result.get("content_length"),
    }


def download_prospectus(ipo_id: str, *, page: Page | None = None) -> bytes:
    url = PROSPECTUS_URL_TEMPLATE.format(id=ipo_id)
    print(f"[DOWNLOAD] Mengambil prospektus ipo_id={ipo_id}...")

    if page is not None:
        pdf_bytes, _ = _fetch_pdf_via_page(page, ipo_id, url)
        return pdf_bytes

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=PLAYWRIGHT_HEADLESS)
        context = browser.new_context(user_agent=BROWSER_USER_AGENT)
        page = context.new_page()
        try:
            pdf_bytes, _ = _fetch_pdf_via_page(page, ipo_id, url)
        finally:
            browser.close()
    return pdf_bytes


def fetch_if_changed(ipo_id: str, *, page: Page | None = None) -> tuple[bytes | None, str]:
    """
    Return (pdf_bytes, hash). pdf_bytes bernilai None jika dokumen
    tidak berubah sejak fetch terakhir -> caller harus skip parsing.
    """
    url = PROSPECTUS_URL_TEMPLATE.format(id=ipo_id)
    cached_meta = _load_cache_meta(ipo_id)
    cached_pdf_path = _pdf_path(ipo_id)

    if cached_meta and os.path.exists(cached_pdf_path) and page is not None:
        try:
            probe = _probe_remote_headers(page, url)
            if probe.get("ok"):
                remote_len = probe.get("content_length")
                remote_etag = probe.get("etag")
                cached_len = cached_meta.get("content_length") or str(cached_meta.get("size"))
                cached_etag = cached_meta.get("etag")

                length_match = remote_len and str(remote_len) == str(cached_len)
                etag_match = (not remote_etag) or (remote_etag == cached_etag)

                if length_match and etag_match:
                    print(f"[CACHE] Prospektus ipo_id={ipo_id} tidak berubah (HEAD), skip download.")
                    return None, cached_meta["hash"]
        except Exception as e:
            print(f"[WARN] HEAD check gagal untuk ipo_id={ipo_id}, lanjut download penuh: {e}")

    pdf_bytes = download_prospectus(ipo_id, page=page)
    new_hash = compute_hash(pdf_bytes)

    if cached_meta and cached_meta.get("hash") == new_hash:
        print(f"[CACHE] Hash identik untuk ipo_id={ipo_id}, skip parsing PDF.")
        return None, new_hash

    headers: dict = {}
    if page is not None:
        try:
            headers = _probe_remote_headers(page, url)
        except Exception:
            pass

    saved_hash = _save_cache(
        ipo_id,
        pdf_bytes,
        content_length=headers.get("content_length"),
        etag=headers.get("etag"),
    )
    return pdf_bytes, saved_hash
