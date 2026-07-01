import sys
sys.path.append('scripts/prospectus_scraper')
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
row = supabase.table("ipos").select("*").eq("ticker", "JELI").execute().data[0]
ipo_id = row['id']

print("--- IPO INSIDER RISK ---")
res1 = supabase.table("ipo_insider_risk").select("*").eq("ipo_id", ipo_id).execute()
print(res1.data)

print("--- SHAREHOLDERS ---")
res2 = supabase.table("ipo_shareholders").select("*").eq("ipo_id", ipo_id).execute()
print(res2.data)

print("--- FINANCIAL HIGHLIGHTS ---")
res3 = supabase.table("ipo_financial_highlights").select("*").eq("ipo_id", ipo_id).execute()
print(res3.data)
