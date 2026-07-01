import os
from supabase import create_client, Client
from dotenv import dotenv_values

MAPPING = {
    'PRDL': {'eipo_id': '350', 'name': 'PT Prodia Diagnostic Line', 'status': 'book building'},
    'EMMI': {'eipo_id': '351', 'name': 'PT Esa Medika Mandiri Tbk', 'status': 'book building'},
    'JECX': {'eipo_id': '352', 'name': 'PT Nitrasanata Dharma Tbk', 'status': 'offering'},
    'BACH': {'eipo_id': '353', 'name': 'PT Bach Multi Global Tbk', 'status': 'book building'},
    'RANS': {'eipo_id': '354', 'name': 'PT Rans Entertainment Indonesia Tbk', 'status': 'book building'}
}

def fix_details():
    env = dotenv_values('.env.local')
    supabase_url = env.get('NEXT_PUBLIC_SUPABASE_URL')
    supabase_key = env.get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    
    if not supabase_url or not supabase_key:
        print("[ERROR] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing")
        return
        
    s: Client = create_client(supabase_url, supabase_key)
    
    for ticker, info in MAPPING.items():
        print(f"\nUpdating {ticker}...")
        
        # Check if ticker exists
        res = s.table('ipos').select('*').eq('ticker', ticker).execute().data
        if not res:
            print(f"[SKIP] Ticker {ticker} tidak ditemukan di database.")
            continue
            
        ipo_uuid = res[0]['id']
        logo_url = f"https://e-ipo.co.id/id/pipeline/get-logo?id={info['eipo_id']}"
        
        payload = {
            'eipo_id': info['eipo_id'],
            'logo_url': logo_url,
            'company_name': info['name'],
            'status': info['status']
        }
        
        s.table('ipos').update(payload).eq('id', ipo_uuid).execute()
        print(f"[OK] {ticker} berhasil diperbarui: Name='{info['name']}', eipo_id={info['eipo_id']}, status='{info['status']}', logo='{logo_url}'")

if __name__ == "__main__":
    fix_details()
