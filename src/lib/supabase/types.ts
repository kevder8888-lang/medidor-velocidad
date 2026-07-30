export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface MeasurementRow {
  id: string;
  created_at: string;
  client_result_id: string | null;
  finished_at: string | null;
  started_at: string | null;
  operator: string | null;
  plan_down_mbps: number | null;
  plan_up_mbps: number | null;
  technology: string | null;
  access_type: string | null;
  access_label: string | null;
  isp_brand: string | null;
  isp_organization: string | null;
  asn: number | null;
  client_ip: string | null;
  download_mbps: number | null;
  upload_mbps: number | null;
  latency_ms: number | null;
  jitter_ms: number | null;
  packet_loss_pct: number | null;
  bufferbloat_ms: number | null;
  cvm_pct: number | null;
  meets_cvm: boolean | null;
  min_guaranteed_mbps: number | null;
  latitude: number | null;
  longitude: number | null;
  geo_accuracy_m: number | null;
  geo_source: string | null;
  geo_timestamp: string | null;
  confidence_score: number | null;
  confidence_level: string | null;
  protocol_version: string | null;
  client_version: string | null;
  server_id: string | null;
  run_index: number | null;
  run_total: number | null;
  signature_hash: string | null;
  payload: Json | null;
}

export type MeasurementInsert = Omit<MeasurementRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export interface Database {
  public: {
    Tables: {
      measurements: {
        Row: MeasurementRow;
        Insert: MeasurementInsert;
        Update: Partial<MeasurementInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
