# Project Context: IPO Decision Tool

## Gambaran Umum
IPO Decision Tool adalah platform analisis dan pemantauan prospektus emiten IPO di Bursa Efek Indonesia (e-IPO). Sistem ini mengumpulkan data dari situs e-IPO, mengekstrak informasi finansial, jadwal, dan struktur permodalan dari prospektus ringkas, serta menyajikannya untuk analisis risiko investasi (khususnya deteksi alokasi dana dan kepemilikan *insider*).

## Arsitektur & Tech Stack
- **Database & Backend Services:** Supabase (PostgreSQL), dengan tabel utama: `ipos`, `ipo_insider_risk`, `ipo_shareholders`, dan `ipo_financial_highlights`.
- **Worker / Scraper:** Python 3.10+ di dalam direktori `scripts/prospectus_scraper/`.
  - **Automation & Discovery:** Playwright (mode *headless*) untuk penjelajahan homepage e-IPO dan pengumpulan status emiten.
  - **AI / LLM Extractor:** Google Generative AI (`gemini-1.5-flash`) dengan *Structured Outputs* (JSON) untuk membaca dan membedah dokumen PDF prospektus ringkas.
- **Frontend / UI:** Next.js (TypeScript, Tailwind CSS) — berada di root direktori proyek.

## Aturan Bisnis Kritis
1. **Pemisahan Status Emiten:** 
   - Emiten berstatus *"book building"* dan *"offering"* diproses dalam pembaruan harian.
   - Emiten *"listed"* atau *"closed"* tidak di-rescrape ulang untuk struktur kepemilikan karena datanya sudah final.
2. **Kondisi Harga IPO (`harga_ipo`):**
   - Wajib bernilai `NULL` selama emiten berada pada tahap *"book building"*.
   - Hanya diisi ketika emiten masuk tahap *"offering"*, *"listed"*, atau *"closed"*.
3. **Validasi Struktur Kepemilikan:**
   - Ekstraksi persentase saham menggunakan sistem *double-call* kondisional dengan *soft threshold* (98% - 102%) dan *hard threshold* (95% - 105%).
   - Jika di luar *hard threshold*, status validasi diset menjadi `"reject"` atau `"perlu_review"`.

## Panduan Pengemban berikutnya
- Selalu periksa kompatibilitas skema database di `migration.sql` sebelum menambahkan penguraian *field* baru dari LLM.
- Gunakan `config.py` di `scripts/prospectus_scraper/` untuk mengatur parameter *rate limit*, *prompt threshold*, dan kunci API.
