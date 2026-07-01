from supabase import create_client, Client
from dotenv import dotenv_values
import json

def patch_jecx():
    env = dotenv_values('.env.local')
    s: Client = create_client(env['NEXT_PUBLIC_SUPABASE_URL'], env['NEXT_PUBLIC_SUPABASE_ANON_KEY'])
    
    # 1. Get JECX UUID
    res = s.table('ipos').select('id').eq('ticker', 'JECX').execute().data
    if not res:
        print("[ERROR] JECX not found in DB")
        return
    uuid = res[0]['id']
    
    # 2. Update JECX main record
    # True range: Rp 1,200 - Rp 1,400. Final: Rp 1,120. Offered shares: 325,322,300 (Saham Baru).
    s.table('ipos').update({
        'bb_price_low': 1200,
        'bb_price_high': 1400,
        'ipo_price': 1120,
        'offered_shares': 325322300,
        'public_float_pct': 10.0 # Saham baru 10%
    }).eq('id', uuid).execute()
    print("[OK] JECX prices and shares updated in ipos table.")
    
    # 3. Update JECX use of proceeds and insider price
    # Total proceeds at Rp 1,120 = Rp 364,360,976,000.
    # BCA: 40B (10.98%), HSBC: 100B (27.45%), Anak Usaha: 185B (50.77%), Sisanya (Modal Kerja): 39.36B (10.80%)
    dana = [
        {
            "kategori": "Pelunasan Utang",
            "judul_singkat": "Pelunasan Utang Bank BCA",
            "deskripsi_ringkas": "Pembayaran lebih awal atas sebagian pokok pinjaman Perseroan kepada Bank BCA.",
            "pct": 10.98,
            "nominal_rupiah": 40000000000
        },
        {
            "kategori": "Pelunasan Utang",
            "judul_singkat": "Pelunasan Utang Bank HSBC",
            "deskripsi_ringkas": "Pembayaran lebih awal atas sebagian pokok pinjaman Perseroan kepada Bank HSBC.",
            "pct": 27.45,
            "nominal_rupiah": 100000000000
        },
        {
            "kategori": "Akuisisi & Investasi",
            "judul_singkat": "Penyaluran ke Entitas Anak",
            "deskripsi_ringkas": "Penyaluran dana ke anak usaha (NSB, Orbita, JCS) untuk modal kerja dan pelunasan pinjaman Bank BCA.",
            "pct": 50.77,
            "nominal_rupiah": 185000000000
        },
        {
            "kategori": "Modal Kerja (OPEX)",
            "judul_singkat": "Modal Kerja Perseroan",
            "deskripsi_ringkas": "Biaya operasional sehari-hari Perseroan, termasuk gaji dan tunjangan karyawan.",
            "pct": 10.80,
            "nominal_rupiah": 39360976000
        }
    ]
    
    s.table('ipo_insider_risk').upsert({
        'ipo_id': uuid,
        'harga_perolehan_insider': 16, # True nominal value
        'penggunaan_dana_raw': json.dumps(dana, ensure_ascii=False),
        'pct_dana_pemegang_lama': 0.0, # Tidak ada divestasi pemegang saham lama dari porsi Perseroan
        'ada_lockup': True,
        'lockup_months': 8
    }, on_conflict='ipo_id').execute()
    print("[OK] JECX use of proceeds and insider price (Rp 16) updated in ipo_insider_risk.")

if __name__ == "__main__":
    patch_jecx()
