from discovery import scrape_detail_page
from config import BASE_URL

try:
    print('START DETAIL SCRAPE')
    summary = scrape_detail_page(f'{BASE_URL}/id/ipo/349/jeli-pt-niramas-utama-tbk')
    if summary is None:
        raise SystemExit('Detail scrape returned None')
    print('SUMMARY TICKER:', summary.ticker)
    print('SUMMARY STATUS:', summary.status)
    print('SUMMARY NAME:', summary.nama)
except Exception as exc:
    print('ERROR during runtime test:', type(exc).__name__, exc)
    raise
