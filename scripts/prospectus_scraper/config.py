import os
from pathlib import Path
from dotenv import load_dotenv

root_dir = Path(__file__).resolve().parent.parent.parent
load_dotenv(root_dir / ".env.local")
load_dotenv(root_dir / ".env")

# --- Supabase ---
SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")

# --- Google Generative AI ---
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
LLM_MODEL = "models/gemini-2.5-flash-lite"  # Model aktif dengan quota tersedia

# --- e-IPO ---
BASE_URL = "https://e-ipo.co.id"
HOME_URL = f"{BASE_URL}/id/home"
PROSPECTUS_URL_TEMPLATE = f"{BASE_URL}/id/pipeline/get-propectus-file?id={{id}}&type=summary"

# --- Validation thresholds ---
OWNERSHIP_TOTAL_MIN_SOFT = 98.0   # di bawah ini -> trigger double-call
OWNERSHIP_TOTAL_MAX_SOFT = 102.0
OWNERSHIP_TOTAL_MIN_HARD = 95.0   # di luar ini -> reject total
OWNERSHIP_TOTAL_MAX_HARD = 105.0

# --- Rate limit guard ---
MAX_API_CALLS_PER_RUN = 25

# --- Local storage untuk hash PDF (hindari re-parse dokumen yang sama) ---
PDF_CACHE_DIR = "./pdf_cache"
