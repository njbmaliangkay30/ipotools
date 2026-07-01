from pdf_downloader import download_prospectus
from extractor import extract_jadwal_harga_dana

ipo_id = '349'
print('DOWNLOAD PROSPECTUS FOR IPO_ID', ipo_id)
pdf_bytes = download_prospectus(ipo_id)
print('PDF_BYTES', len(pdf_bytes))
result = extract_jadwal_harga_dana(pdf_bytes)
print('GEMINI RESULT', result)
