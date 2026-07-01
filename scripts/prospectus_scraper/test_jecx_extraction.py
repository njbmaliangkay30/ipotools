import json
from extractor import extract_jadwal_harga_dana, extract_financial

def test():
    print("Membaca JECX.pdf...")
    with open("scratch/pdf/JECX.pdf", "rb") as f:
        pdf_bytes = f.read()
        
    print("\n--- Ekstraksi Jadwal, Harga, Dana JECX ---")
    res_dana = extract_jadwal_harga_dana(pdf_bytes)
    print(json.dumps(res_dana, indent=2))
    
    print("\n--- Ekstraksi Financial Highlights JECX ---")
    res_fin = extract_financial(pdf_bytes)
    print(json.dumps(res_fin, indent=2))

if __name__ == "__main__":
    test()
