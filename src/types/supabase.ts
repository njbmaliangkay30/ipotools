export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      ipos: {
        Row: {
          id: string
          ticker: string
          nama: string | null
          status: string | null
          sektor: string | null
          subsektor: string | null
          lini_bisnis: string | null
          harga_ipo: number | null
          bb_price_low: number | null
          bb_price_high: number | null
          jumlah_saham_ditawarkan: number | null
          pct_total_shares: number | null
          bb_open: string | null
          bb_close: string | null
          offering_open: string | null
          offering_close: string | null
          closing_date: string | null
          distribution_date: string | null
          listing_date: string | null
          warrant_ratio: number | null
          warrant_exercise_price: number | null
          listing_board: string | null
          offered_shares_nli: number | null
          subscribed_shares: number | null
          os_ratio_aktual: number | null
          public_pct: number | null
          has_warrant_nli: boolean | null
          pct_working_cap: number | null
          pct_capex: number | null
          pct_subsidiaries: number | null
          pct_debt_payment: number | null
          pct_expansion: number | null
          pct_acquisition: number | null
          nli_parsed_at: string | null
          scraped_at: string | null
          created_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['ipos']['Row']>
        Update: Partial<Database['public']['Tables']['ipos']['Row']>
      }
      underwriters: {
        Row: {
          id: string
          broker_code: string
          nama: string | null
          total_ipo_lead: number | null
          total_ipo_colead: number | null
          win_rate: number | null
          ara_d1_rate: number | null
          avg_ara_streak: number | null
          avg_return_d1: number | null
          avg_return_d5: number | null
          avg_os_ratio: number | null
          data_points: number | null
          updated_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['underwriters']['Row']>
        Update: Partial<Database['public']['Tables']['underwriters']['Row']>
      }
      ipo_underwriters: {
        Row: {
          ipo_id: string
          underwriter_id: string
          role: string | null
          pct_penjaminan: number | null
        }
        Insert: Partial<Database['public']['Tables']['ipo_underwriters']['Row']>
        Update: Partial<Database['public']['Tables']['ipo_underwriters']['Row']>
      }
      ipo_insider_risk: {
        Row: {
          ipo_id: string
          harga_perolehan_insider: number | null
          price_gap_ratio: number | null
          ada_lockup: boolean | null
          lockup_months: number | null
          pct_divestasi: number | null
          penggunaan_dana_kategori: string | null
          penggunaan_dana_raw: string | null
          insider_risk_level: string | null
          updated_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['ipo_insider_risk']['Row']>
        Update: Partial<Database['public']['Tables']['ipo_insider_risk']['Row']>
      }
      ipo_signals: {
        Row: {
          ipo_id: string
          google_trends_score: number | null
          news_count_30d: number | null
          sektor_momentum_60d: number | null
          community_buzz: number | null
          os_estimate: number | null
          os_confidence: string | null
          queue_estimate_manual: number | null
          fetched_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['ipo_signals']['Row']>
        Update: Partial<Database['public']['Tables']['ipo_signals']['Row']>
      }
      ipo_outcomes: {
        Row: {
          ipo_id: string
          harga_d1: number | null
          harga_d5: number | null
          harga_d7: number | null
          return_d1: number | null
          return_d5: number | null
          ara_d1: boolean | null
          ara_streak: number | null
          lot_aktual: number | null
          catatan: string | null
          fetched_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['ipo_outcomes']['Row']>
        Update: Partial<Database['public']['Tables']['ipo_outcomes']['Row']>
      }
      decisions: {
        Row: {
          id: string
          ipo_id: string | null
          keputusan: string | null
          jumlah_akun: number | null
          reasoning_notes: string | null
          created_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['decisions']['Row']>
        Update: Partial<Database['public']['Tables']['decisions']['Row']>
      }
    }
  }
}
