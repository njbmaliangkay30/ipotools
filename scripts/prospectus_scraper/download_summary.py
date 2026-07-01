from playwright.sync_api import sync_playwright
import os, sys

os.makedirs('scratch/pdf', exist_ok=True)

ticker = sys.argv[1].upper() if len(sys.argv) > 1 else 'JELI'
ipo_id = sys.argv[2] if len(sys.argv) > 2 else '349'
out_path = f'scratch/pdf/{ticker}.pdf'

url_summary = f'https://e-ipo.co.id/id/pipeline/get-propectus-file?id={ipo_id}&type=summary'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        accept_downloads=True,
    )
    page = context.new_page()

    # Kunjungi detail page dulu untuk cookies + referer
    print(f'[1] Membuka halaman detail IPO...')
    page.goto(f'https://e-ipo.co.id/id/ipo/{ipo_id}/jeli-pt-niramas-utama-tbk',
              wait_until='domcontentloaded', timeout=20000)
    page.wait_for_timeout(1500)

    # Intercept file download
    print(f'[2] Mengunduh ringkasan prospektus...')
    try:
        with page.expect_download(timeout=20000) as dl_info:
            page.evaluate(f"window.location.href = '{url_summary}'")
        download = dl_info.value
        download.save_as(out_path)
        print(f'[OK] Tersimpan: {out_path} ({os.path.getsize(out_path)} bytes)')
    except Exception as e:
        print(f'[WARN] expect_download gagal: {e}')
        # Fallback: gunakan fetch() dari dalam halaman (pakai session browser)
        print('[3] Mencoba via fetch() dalam browser...')
        result = page.evaluate(f"""
            async () => {{
                const resp = await fetch('{url_summary}', {{credentials: 'include'}});
                const buf = await resp.arrayBuffer();
                return {{
                    status: resp.status,
                    size: buf.byteLength,
                    type: resp.headers.get('content-type') || ''
                }};
            }}
        """)
        print('Fetch result:', result)

        if result.get('status') == 200 and result.get('size', 0) > 10000:
            # Ambil bytes via CDP
            cdp = context.new_cdp_session(page)
            body_resp = page.evaluate(f"""
                async () => {{
                    const resp = await fetch('{url_summary}', {{credentials: 'include'}});
                    const buf = await resp.arrayBuffer();
                    return Array.from(new Uint8Array(buf));
                }}
            """)
            with open(out_path, 'wb') as f:
                f.write(bytes(body_resp))
            print(f'[OK] Tersimpan via fetch: {out_path} ({os.path.getsize(out_path)} bytes)')
        else:
            print('[GAGAL] Tidak bisa download ringkasan prospektus.')

    browser.close()
