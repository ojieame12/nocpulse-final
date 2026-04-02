import type { JsonValue } from "./json";

export type DatabaseSchema = {
  app: {
    Tables: {
      workspaces: {
        Row: {
          id: string;
          slug: string;
          name: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          slug: string;
          name: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      workspace_memberships: {
        Row: {
          workspace_id: string;
          user_id: string;
          role: "owner" | "manager" | "member" | "viewer";
          invited_by: string | null;
          created_at: string;
        };
        Insert: {
          workspace_id: string;
          user_id: string;
          role: "owner" | "manager" | "member" | "viewer";
          invited_by?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          role: "owner" | "manager" | "member" | "viewer";
          invited_by: string | null;
          created_at: string;
        }>;
        Relationships: [];
      };
      workspace_email_provisions: {
        Row: {
          workspace_id: string;
          email: string;
          role: "owner" | "manager" | "member" | "viewer";
          created_by: string | null;
          created_at: string;
          claimed_by: string | null;
          claimed_at: string | null;
        };
        Insert: {
          workspace_id: string;
          email: string;
          role: "owner" | "manager" | "member" | "viewer";
          created_by?: string | null;
          created_at?: string;
          claimed_by?: string | null;
          claimed_at?: string | null;
        };
        Update: Partial<{
          role: "owner" | "manager" | "member" | "viewer";
          created_by: string | null;
          created_at: string;
          claimed_by: string | null;
          claimed_at: string | null;
        }>;
        Relationships: [];
      };
      request_access_requests: {
        Row: {
          id: string;
          name: string;
          email: string;
          farm_name: string;
          acreage: string | null;
          message: string | null;
          status: "new" | "reviewed" | "contacted" | "archived";
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          farm_name: string;
          acreage?: string | null;
          message?: string | null;
          status?: "new" | "reviewed" | "contacted" | "archived";
          created_at?: string;
        };
        Update: Partial<{
          name: string;
          email: string;
          farm_name: string;
          acreage: string | null;
          message: string | null;
          status: "new" | "reviewed" | "contacted" | "archived";
          created_at: string;
        }>;
        Relationships: [];
      };
      rate_limit_events: {
        Row: {
          id: number;
          scope: string;
          identifier: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          scope: string;
          identifier: string;
          created_at?: string;
        };
        Update: Partial<{
          scope: string;
          identifier: string;
          created_at: string;
        }>;
        Relationships: [];
      };
      audit_events: {
        Row: {
          id: string;
          action: string;
          actor_user_id: string;
          workspace_id: string | null;
          resource_type: string;
          resource_id: string | null;
          route: string;
          metadata: JsonValue;
          created_at: string;
        };
        Insert: {
          id?: string;
          action: string;
          actor_user_id: string;
          workspace_id?: string | null;
          resource_type: string;
          resource_id?: string | null;
          route: string;
          metadata?: JsonValue;
          created_at?: string;
        };
        Update: Partial<{
          action: string;
          actor_user_id: string;
          workspace_id: string | null;
          resource_type: string;
          resource_id: string | null;
          route: string;
          metadata: JsonValue;
          created_at: string;
        }>;
        Relationships: [];
      };
      workspace_share_tokens: {
        Row: {
          id: string;
          workspace_id: string;
          field_id: string;
          token_hash: string;
          created_by: string;
          created_at: string;
          expires_at: string;
          revoked_at: string | null;
          last_accessed_at: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          field_id: string;
          token_hash: string;
          created_by: string;
          created_at?: string;
          expires_at: string;
          revoked_at?: string | null;
          last_accessed_at?: string | null;
        };
        Update: Partial<{
          workspace_id: string;
          field_id: string;
          token_hash: string;
          created_by: string;
          created_at: string;
          expires_at: string;
          revoked_at: string | null;
          last_accessed_at: string | null;
        }>;
        Relationships: [];
      };
      workspace_user_settings: {
        Row: {
          workspace_id: string;
          user_id: string;
          email_alerts: boolean;
          health_warnings: boolean;
          spray_windows: boolean;
          weekly_digest: boolean;
          units: "metric" | "imperial";
          temperature_unit: "celsius" | "fahrenheit";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          user_id: string;
          email_alerts?: boolean;
          health_warnings?: boolean;
          spray_windows?: boolean;
          weekly_digest?: boolean;
          units?: "metric" | "imperial";
          temperature_unit?: "celsius" | "fahrenheit";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          email_alerts: boolean;
          health_warnings: boolean;
          spray_windows: boolean;
          weekly_digest: boolean;
          units: "metric" | "imperial";
          temperature_unit: "celsius" | "fahrenheit";
          created_at: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      fields: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          area_ha: number | string;
          legal_land_description: string | null;
          boundary: JsonValue;
          label_point: JsonValue;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          area_ha: number | string;
          legal_land_description?: string | null;
          boundary: JsonValue;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          name: string;
          area_ha: number | string;
          legal_land_description: string | null;
          boundary: JsonValue;
          created_by: string;
          created_at: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      field_moisture_snapshots: {
        Row: {
          id: string;
          workspace_id: string;
          field_id: string;
          observed_at: string;
          source_key: string;
          root_zone_pct: number | string;
          surface_pct: number | string;
          confidence: "low" | "medium" | "high";
          inputs: JsonValue;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          field_id: string;
          observed_at: string;
          source_key: string;
          root_zone_pct: number | string;
          surface_pct: number | string;
          confidence: "low" | "medium" | "high";
          inputs?: JsonValue;
          created_at?: string;
        };
        Update: Partial<{
          observed_at: string;
          source_key: string;
          root_zone_pct: number | string;
          surface_pct: number | string;
          confidence: "low" | "medium" | "high";
          inputs: JsonValue;
          created_at: string;
        }>;
        Relationships: [];
      };
      field_moisture_cell_snapshots: {
        Row: {
          id: string;
          workspace_id: string;
          field_id: string;
          snapshot_id: string;
          observed_at: string;
          source_key: string;
          cell_key: string;
          row_index: number;
          column_index: number;
          centroid: JsonValue;
          boundary: JsonValue;
          root_zone_pct: number | string;
          surface_pct: number | string;
          confidence: "low" | "medium" | "high";
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          field_id: string;
          snapshot_id: string;
          observed_at: string;
          source_key: string;
          cell_key: string;
          row_index: number;
          column_index: number;
          centroid: JsonValue;
          boundary: JsonValue;
          root_zone_pct: number | string;
          surface_pct: number | string;
          confidence: "low" | "medium" | "high";
          created_at?: string;
        };
        Update: Partial<{
          observed_at: string;
          source_key: string;
          cell_key: string;
          row_index: number;
          column_index: number;
          centroid: JsonValue;
          boundary: JsonValue;
          root_zone_pct: number | string;
          surface_pct: number | string;
          confidence: "low" | "medium" | "high";
          created_at: string;
        }>;
        Relationships: [];
      };
      field_weather_observations: {
        Row: {
          id: string;
          workspace_id: string;
          field_id: string;
          observed_at: string;
          source_key: string;
          provider_key: string;
          air_temperature_c: number | string;
          precipitation_mm: number | string;
          wind_speed_kph: number | string;
          relative_humidity_pct: number | string | null;
          soil_moisture_pct: number | string | null;
          soil_temperature_6cm_c: number | string | null;
          evapotranspiration_mm: number | string | null;
          provenance: JsonValue;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          field_id: string;
          observed_at: string;
          source_key: string;
          provider_key: string;
          air_temperature_c: number | string;
          precipitation_mm?: number | string;
          wind_speed_kph?: number | string;
          relative_humidity_pct?: number | string | null;
          soil_moisture_pct?: number | string | null;
          soil_temperature_6cm_c?: number | string | null;
          evapotranspiration_mm?: number | string | null;
          provenance?: JsonValue;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          observed_at: string;
          source_key: string;
          provider_key: string;
          air_temperature_c: number | string;
          precipitation_mm: number | string;
          wind_speed_kph: number | string;
          relative_humidity_pct: number | string | null;
          soil_moisture_pct: number | string | null;
          soil_temperature_6cm_c: number | string | null;
          evapotranspiration_mm: number | string | null;
          provenance: JsonValue;
          created_at: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      field_weather_forecasts: {
        Row: {
          id: string;
          workspace_id: string;
          field_id: string;
          forecast_run_at: string;
          valid_at: string;
          source_key: string;
          provider_key: string;
          air_temperature_min_c: number | string;
          air_temperature_max_c: number | string;
          precipitation_mm: number | string;
          wind_speed_kph: number | string;
          relative_humidity_pct: number | string | null;
          evapotranspiration_mm: number | string | null;
          precipitation_probability_pct: number | string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          field_id: string;
          forecast_run_at: string;
          valid_at: string;
          source_key: string;
          provider_key: string;
          air_temperature_min_c: number | string;
          air_temperature_max_c: number | string;
          precipitation_mm?: number | string;
          wind_speed_kph?: number | string;
          relative_humidity_pct?: number | string | null;
          evapotranspiration_mm?: number | string | null;
          precipitation_probability_pct?: number | string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          forecast_run_at: string;
          valid_at: string;
          source_key: string;
          provider_key: string;
          air_temperature_min_c: number | string;
          air_temperature_max_c: number | string;
          precipitation_mm: number | string;
          wind_speed_kph: number | string;
          relative_humidity_pct: number | string | null;
          evapotranspiration_mm: number | string | null;
          precipitation_probability_pct: number | string | null;
          created_at: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      field_weather_signal_sets: {
        Row: {
          id: string;
          workspace_id: string;
          field_id: string;
          weather_observation_id: string | null;
          observed_at: string;
          forecast_run_at: string | null;
          source_key: string;
          provider_key: string;
          signal_version: string;
          current_vpd_kpa: number | string | null;
          peak_forecast_vpd_kpa_24h: number | string | null;
          net_water_balance_24h_mm: number | string | null;
          net_water_balance_72h_mm: number | string | null;
          leaf_wet_hours_24h: number;
          spray_window_count_24h: number;
          frost_risk_min_temp_c: number | string | null;
          frost_risk_min_temp_c_7d: number | string | null;
          frost_risk_nights_7d: number | string | null;
          recent_precip_total_72h_mm: number | string | null;
          freeze_thaw_cycles_7d: number | string | null;
          soil_temp_6cm_current_c: number | string | null;
          soil_temp_6cm_sustained_days: number | string | null;
          gdd_24h: number | string | null;
          gdd_72h: number | string | null;
          gdd_base_c: number | string;
          provenance: JsonValue;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          field_id: string;
          weather_observation_id?: string | null;
          observed_at: string;
          forecast_run_at?: string | null;
          source_key: string;
          provider_key: string;
          signal_version: string;
          current_vpd_kpa?: number | string | null;
          peak_forecast_vpd_kpa_24h?: number | string | null;
          net_water_balance_24h_mm?: number | string | null;
          net_water_balance_72h_mm?: number | string | null;
          leaf_wet_hours_24h?: number;
          spray_window_count_24h?: number;
          frost_risk_min_temp_c?: number | string | null;
          frost_risk_min_temp_c_7d?: number | string | null;
          frost_risk_nights_7d?: number | string | null;
          recent_precip_total_72h_mm?: number | string | null;
          freeze_thaw_cycles_7d?: number | string | null;
          soil_temp_6cm_current_c?: number | string | null;
          soil_temp_6cm_sustained_days?: number | string | null;
          gdd_24h?: number | string | null;
          gdd_72h?: number | string | null;
          gdd_base_c?: number | string;
          provenance?: JsonValue;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          weather_observation_id: string | null;
          observed_at: string;
          forecast_run_at: string | null;
          source_key: string;
          provider_key: string;
          signal_version: string;
          current_vpd_kpa: number | string | null;
          peak_forecast_vpd_kpa_24h: number | string | null;
          net_water_balance_24h_mm: number | string | null;
          net_water_balance_72h_mm: number | string | null;
          leaf_wet_hours_24h: number;
          spray_window_count_24h: number;
          frost_risk_min_temp_c: number | string | null;
          frost_risk_min_temp_c_7d: number | string | null;
          frost_risk_nights_7d: number | string | null;
          recent_precip_total_72h_mm: number | string | null;
          freeze_thaw_cycles_7d: number | string | null;
          soil_temp_6cm_current_c: number | string | null;
          soil_temp_6cm_sustained_days: number | string | null;
          gdd_24h: number | string | null;
          gdd_72h: number | string | null;
          gdd_base_c: number | string;
          provenance: JsonValue;
          created_at: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      field_crop_contexts: {
        Row: {
          id: string;
          workspace_id: string;
          field_id: string;
          season_year: number;
          crop_type: string;
          growth_stage: string | null;
          growth_stage_source: string;
          accumulated_gdd: number | string;
          last_gdd_observed_on: string | null;
          last_weather_signal_set_id: string | null;
          last_stage_updated_at: string | null;
          source_key: string;
          metadata: JsonValue;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          field_id: string;
          season_year: number;
          crop_type: string;
          growth_stage?: string | null;
          growth_stage_source?: string;
          accumulated_gdd?: number | string;
          last_gdd_observed_on?: string | null;
          last_weather_signal_set_id?: string | null;
          last_stage_updated_at?: string | null;
          source_key: string;
          metadata?: JsonValue;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          season_year: number;
          crop_type: string;
          growth_stage: string | null;
          growth_stage_source: string;
          accumulated_gdd: number | string;
          last_gdd_observed_on: string | null;
          last_weather_signal_set_id: string | null;
          last_stage_updated_at: string | null;
          source_key: string;
          metadata: JsonValue;
          created_at: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      field_basis_assumptions: {
        Row: {
          id: string;
          workspace_id: string;
          field_id: string;
          season_year: number | null;
          crop_symbol: string | null;
          basis_cad_per_tonne: number | string;
          source_key: string;
          note_text: string | null;
          assumed_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          field_id: string;
          season_year?: number | null;
          crop_symbol?: string | null;
          basis_cad_per_tonne: number | string;
          source_key: string;
          note_text?: string | null;
          assumed_at?: string;
          created_at?: string;
        };
        Update: Partial<{
          season_year: number | null;
          crop_symbol: string | null;
          basis_cad_per_tonne: number | string;
          source_key: string;
          note_text: string | null;
          assumed_at: string;
          created_at: string;
        }>;
        Relationships: [];
      };
      field_raster_observations: {
        Row: {
          id: string;
          workspace_id: string;
          field_id: string;
          observed_at: string;
          source_key: string;
          provider_key: string;
          artifact_key: string | null;
          metadata: JsonValue;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          field_id: string;
          observed_at: string;
          source_key: string;
          provider_key: string;
          artifact_key?: string | null;
          metadata?: JsonValue;
          created_at?: string;
        };
        Update: Partial<{
          observed_at: string;
          source_key: string;
          provider_key: string;
          artifact_key: string | null;
          metadata: JsonValue;
          created_at: string;
        }>;
        Relationships: [];
      };
      field_raster_observation_cells: {
        Row: {
          id: string;
          observation_id: string;
          workspace_id: string;
          field_id: string;
          observed_at: string;
          source_key: string;
          provider_key: string;
          cell_key: string;
          row_index: number;
          column_index: number;
          centroid: JsonValue;
          boundary: JsonValue;
          measurements: JsonValue;
          created_at: string;
        };
        Insert: {
          id?: string;
          observation_id: string;
          workspace_id: string;
          field_id: string;
          observed_at: string;
          source_key: string;
          provider_key: string;
          cell_key: string;
          row_index: number;
          column_index: number;
          centroid: JsonValue;
          boundary: JsonValue;
          measurements?: JsonValue;
          created_at?: string;
        };
        Update: Partial<{
          observed_at: string;
          source_key: string;
          provider_key: string;
          cell_key: string;
          row_index: number;
          column_index: number;
          centroid: JsonValue;
          boundary: JsonValue;
          measurements: JsonValue;
          created_at: string;
        }>;
        Relationships: [];
      };
      field_scout_notes: {
        Row: {
          id: string;
          workspace_id: string;
          field_id: string;
          finding_id: string | null;
          zone_id: string | null;
          cell_key: string | null;
          outcome: "confirmed" | "not_confirmed" | "resolved" | "monitor";
          note_text: string;
          observed_at: string;
          created_by_user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          field_id: string;
          finding_id?: string | null;
          zone_id?: string | null;
          cell_key?: string | null;
          outcome: "confirmed" | "not_confirmed" | "resolved" | "monitor";
          note_text: string;
          observed_at?: string;
          created_by_user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          finding_id: string | null;
          zone_id: string | null;
          cell_key: string | null;
          outcome: "confirmed" | "not_confirmed" | "resolved" | "monitor";
          note_text: string;
          observed_at: string;
          created_by_user_id: string;
          created_at: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      field_soil_properties: {
        Row: {
          field_id: string;
          field_capacity_pct: number | null;
          wilting_point_pct: number | null;
          soil_properties_fetched_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          field_id: string;
          field_capacity_pct?: number | null;
          wilting_point_pct?: number | null;
          soil_properties_fetched_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          field_capacity_pct: number | null;
          wilting_point_pct: number | null;
          soil_properties_fetched_at: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      field_yield_assumptions: {
        Row: {
          id: string;
          workspace_id: string;
          field_id: string;
          season_year: number | null;
          crop_symbol: string | null;
          yield_tonnes_per_ha: number | string;
          source_key: string;
          note_text: string | null;
          assumed_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          field_id: string;
          season_year?: number | null;
          crop_symbol?: string | null;
          yield_tonnes_per_ha: number | string;
          source_key: string;
          note_text?: string | null;
          assumed_at?: string;
          created_at?: string;
        };
        Update: Partial<{
          workspace_id: string;
          field_id: string;
          season_year: number | null;
          crop_symbol: string | null;
          yield_tonnes_per_ha: number | string;
          source_key: string;
          note_text: string | null;
          assumed_at: string;
          created_at: string;
        }>;
        Relationships: [];
      };
      grain_price_snapshots: {
        Row: {
          id: string;
          crop_symbol: string;
          close_price_cad_per_tonne: number | string;
          basis_cad_per_tonne: number | string;
          source_currency: string;
          source_unit: string;
          source_close_price: number | string;
          fx_rate_to_cad: number | string;
          source_key: string;
          captured_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          crop_symbol: string;
          close_price_cad_per_tonne: number | string;
          basis_cad_per_tonne?: number | string;
          source_currency?: string;
          source_unit?: string;
          source_close_price?: number | string;
          fx_rate_to_cad?: number | string;
          source_key: string;
          captured_at?: string;
          created_at?: string;
        };
        Update: Partial<{
          crop_symbol: string;
          close_price_cad_per_tonne: number | string;
          basis_cad_per_tonne: number | string;
          source_currency: string;
          source_unit: string;
          source_close_price: number | string;
          fx_rate_to_cad: number | string;
          source_key: string;
          captured_at: string;
          created_at: string;
        }>;
        Relationships: [];
      };
      field_imagery_captures: {
        Row: {
          id: string;
          workspace_id: string;
          field_id: string;
          requested_at: string;
          captured_at: string;
          provider_key: string;
          scene_key: string;
          status: "dry-run" | "discovered" | "materialized" | "unavailable";
          coverage_pct: number | string;
          cloud_cover_pct: number | string | null;
          note: string | null;
          metadata: JsonValue;
          observation_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          field_id: string;
          requested_at: string;
          captured_at: string;
          provider_key: string;
          scene_key: string;
          status: "dry-run" | "discovered" | "materialized" | "unavailable";
          coverage_pct: number | string;
          cloud_cover_pct?: number | string | null;
          note?: string | null;
          metadata?: JsonValue;
          observation_id?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          requested_at: string;
          captured_at: string;
          provider_key: string;
          scene_key: string;
          status: "dry-run" | "discovered" | "materialized" | "unavailable";
          coverage_pct: number | string;
          cloud_cover_pct: number | string | null;
          note: string | null;
          metadata: JsonValue;
          observation_id: string | null;
          created_at: string;
        }>;
        Relationships: [];
      };
      imagery_provider_probe_runs: {
        Row: {
          id: string;
          workspace_id: string;
          field_id: string;
          provider_key: string;
          requested_at: string;
          provider_status: "ready" | "fallback" | "unavailable";
          discovery_mode: string;
          materialization_mode: string;
          discovery_client: string | null;
          materialization_client: string | null;
          fallback_client: string | null;
          reason: string | null;
          probe_status: "provider-scene" | "fallback-scene" | "no-scene" | "error";
          probe_scene_key: string | null;
          probe_captured_at: string | null;
          probe_discovery_mode: string | null;
          probe_discovery_client: string | null;
          probe_reason: string | null;
          details: JsonValue;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          field_id: string;
          provider_key: string;
          requested_at: string;
          provider_status: "ready" | "fallback" | "unavailable";
          discovery_mode: string;
          materialization_mode: string;
          discovery_client?: string | null;
          materialization_client?: string | null;
          fallback_client?: string | null;
          reason?: string | null;
          probe_status: "provider-scene" | "fallback-scene" | "no-scene" | "error";
          probe_scene_key?: string | null;
          probe_captured_at?: string | null;
          probe_discovery_mode?: string | null;
          probe_discovery_client?: string | null;
          probe_reason?: string | null;
          details?: JsonValue;
          created_at?: string;
        };
        Update: Partial<{
          provider_key: string;
          requested_at: string;
          provider_status: "ready" | "fallback" | "unavailable";
          discovery_mode: string;
          materialization_mode: string;
          discovery_client: string | null;
          materialization_client: string | null;
          fallback_client: string | null;
          reason: string | null;
          probe_status: "provider-scene" | "fallback-scene" | "no-scene" | "error";
          probe_scene_key: string | null;
          probe_captured_at: string | null;
          probe_discovery_mode: string | null;
          probe_discovery_client: string | null;
          probe_reason: string | null;
          details: JsonValue;
          created_at: string;
        }>;
        Relationships: [];
      };
      field_hail_events: {
        Row: {
          id: string;
          workspace_id: string;
          field_id: string;
          provider_key: string;
          source_key: string;
          source_event_key: string;
          dedupe_key: string;
          event_type: "warning" | "observed";
          severity: "advisory" | "watch" | "warning" | "severe";
          reported_at: string;
          window_start: string | null;
          window_end: string | null;
          headline: string;
          summary: string | null;
          hail_size_mm: number | string | null;
          coverage_geojson: JsonValue | null;
          provenance: JsonValue;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          field_id: string;
          provider_key: string;
          source_key: string;
          source_event_key: string;
          dedupe_key: string;
          event_type: "warning" | "observed";
          severity: "advisory" | "watch" | "warning" | "severe";
          reported_at: string;
          window_start?: string | null;
          window_end?: string | null;
          headline: string;
          summary?: string | null;
          hail_size_mm?: number | string | null;
          coverage_geojson?: JsonValue | null;
          provenance?: JsonValue;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          provider_key: string;
          source_key: string;
          source_event_key: string;
          dedupe_key: string;
          event_type: "warning" | "observed";
          severity: "advisory" | "watch" | "warning" | "severe";
          reported_at: string;
          window_start: string | null;
          window_end: string | null;
          headline: string;
          summary: string | null;
          hail_size_mm: number | string | null;
          coverage_geojson: JsonValue | null;
          provenance: JsonValue;
          created_at: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      field_hail_refresh_runs: {
        Row: {
          id: string;
          workspace_id: string;
          field_id: string;
          provider_key: string;
          source_key: string;
          requested_at: string;
          completed_at: string | null;
          status: "completed" | "failed";
          matched_event_count: number;
          latest_matched_reported_at: string | null;
          error_message: string | null;
          provenance: JsonValue;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          field_id: string;
          provider_key: string;
          source_key: string;
          requested_at: string;
          completed_at?: string | null;
          status: "completed" | "failed";
          matched_event_count?: number;
          latest_matched_reported_at?: string | null;
          error_message?: string | null;
          provenance?: JsonValue;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          provider_key: string;
          source_key: string;
          requested_at: string;
          completed_at: string | null;
          status: "completed" | "failed";
          matched_event_count: number;
          latest_matched_reported_at: string | null;
          error_message: string | null;
          provenance: JsonValue;
          created_at: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      field_alerts: {
        Row: {
          id: string;
          workspace_id: string;
          field_id: string;
          family: string;
          severity: "low" | "medium" | "high" | "critical";
          status: "active" | "resolved" | "dismissed";
          source_key: string;
          dedupe_key: string;
          title: string;
          summary: string | null;
          explanation: string | null;
          recommended_action: string | null;
          facts: JsonValue;
          evidence: JsonValue;
          started_at: string;
          ended_at: string | null;
          acknowledged_at: string | null;
          acknowledged_by_user_id: string | null;
          resolved_at: string | null;
          resolution_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          field_id: string;
          family: string;
          severity: "low" | "medium" | "high" | "critical";
          status?: "active" | "resolved" | "dismissed";
          source_key: string;
          dedupe_key: string;
          title: string;
          summary?: string | null;
          explanation?: string | null;
          recommended_action?: string | null;
          facts?: JsonValue;
          evidence?: JsonValue;
          started_at: string;
          ended_at?: string | null;
          acknowledged_at?: string | null;
          acknowledged_by_user_id?: string | null;
          resolved_at?: string | null;
          resolution_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          family: string;
          severity: "low" | "medium" | "high" | "critical";
          status: "active" | "resolved" | "dismissed";
          source_key: string;
          dedupe_key: string;
          title: string;
          summary: string | null;
          explanation: string | null;
          recommended_action: string | null;
          facts: JsonValue;
          evidence: JsonValue;
          started_at: string;
          ended_at: string | null;
          acknowledged_at: string | null;
          acknowledged_by_user_id: string | null;
          resolved_at: string | null;
          resolution_note: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      field_intelligence_runs: {
        Row: {
          id: string;
          workspace_id: string;
          field_id: string;
          source_key: string;
          model_key: string;
          status: "planned" | "running" | "completed" | "failed";
          started_at: string;
          completed_at: string | null;
          input_version: string | null;
          provenance: JsonValue;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          field_id: string;
          source_key: string;
          model_key: string;
          status: "planned" | "running" | "completed" | "failed";
          started_at: string;
          completed_at?: string | null;
          input_version?: string | null;
          provenance?: JsonValue;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          source_key: string;
          model_key: string;
          status: "planned" | "running" | "completed" | "failed";
          started_at: string;
          completed_at: string | null;
          input_version: string | null;
          provenance: JsonValue;
          created_at: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      field_intelligence_findings: {
        Row: {
          id: string;
          workspace_id: string;
          field_id: string;
          run_id: string | null;
          family: string;
          severity: "low" | "medium" | "high" | "critical";
          status: "active" | "resolved" | "dismissed";
          source_key: string;
          dedupe_key: string;
          title: string;
          summary: string | null;
          explanation: string | null;
          recommended_action: string | null;
          confidence: number | string | null;
          zone_geojson: JsonValue | null;
          affected_cell_keys: string[];
          evidence: JsonValue;
          started_at: string;
          ended_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          field_id: string;
          run_id?: string | null;
          family: string;
          severity: "low" | "medium" | "high" | "critical";
          status?: "active" | "resolved" | "dismissed";
          source_key: string;
          dedupe_key: string;
          title: string;
          summary?: string | null;
          explanation?: string | null;
          recommended_action?: string | null;
          confidence?: number | string | null;
          zone_geojson?: JsonValue | null;
          affected_cell_keys?: string[];
          evidence?: JsonValue;
          started_at: string;
          ended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          run_id: string | null;
          family: string;
          severity: "low" | "medium" | "high" | "critical";
          status: "active" | "resolved" | "dismissed";
          source_key: string;
          dedupe_key: string;
          title: string;
          summary: string | null;
          explanation: string | null;
          recommended_action: string | null;
          confidence: number | string | null;
          zone_geojson: JsonValue | null;
          affected_cell_keys: string[];
          evidence: JsonValue;
          started_at: string;
          ended_at: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      field_intelligence_zones: {
        Row: {
          id: string;
          workspace_id: string;
          field_id: string;
          family: string;
          tracking_key: string;
          latest_finding_id: string | null;
          latest_run_id: string | null;
          status: "new" | "persistent" | "recovering" | "resolved";
          latest_severity: "low" | "medium" | "high" | "critical" | null;
          zone_geojson: JsonValue;
          affected_cell_keys: string[];
          detection_count: number;
          first_seen_at: string;
          last_seen_at: string;
          last_status_changed_at: string;
          metadata: JsonValue;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          field_id: string;
          family: string;
          tracking_key: string;
          latest_finding_id?: string | null;
          latest_run_id?: string | null;
          status: "new" | "persistent" | "recovering" | "resolved";
          latest_severity?: "low" | "medium" | "high" | "critical" | null;
          zone_geojson: JsonValue;
          affected_cell_keys?: string[];
          detection_count?: number;
          first_seen_at: string;
          last_seen_at: string;
          last_status_changed_at: string;
          metadata?: JsonValue;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          family: string;
          tracking_key: string;
          latest_finding_id: string | null;
          latest_run_id: string | null;
          status: "new" | "persistent" | "recovering" | "resolved";
          latest_severity: "low" | "medium" | "high" | "critical" | null;
          zone_geojson: JsonValue;
          affected_cell_keys: string[];
          detection_count: number;
          first_seen_at: string;
          last_seen_at: string;
          last_status_changed_at: string;
          metadata: JsonValue;
          created_at: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      field_import_batches: {
        Row: {
          id: string;
          workspace_id: string;
          source_type: string;
          file_name: string;
          sheet_name: string;
          status: "previewed" | "committed";
          row_count: number;
          valid_row_count: number;
          field_count: number;
          issue_count: number;
          issues: JsonValue;
          created_by: string;
          committed_by: string | null;
          committed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          source_type: string;
          file_name: string;
          sheet_name: string;
          status?: "previewed" | "committed";
          row_count: number;
          valid_row_count: number;
          field_count: number;
          issue_count: number;
          issues?: JsonValue;
          created_by: string;
          committed_by?: string | null;
          committed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          source_type: string;
          file_name: string;
          sheet_name: string;
          status: "previewed" | "committed";
          row_count: number;
          valid_row_count: number;
          field_count: number;
          issue_count: number;
          issues: JsonValue;
          created_by: string;
          committed_by: string | null;
          committed_at: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      field_import_candidates: {
        Row: {
          id: string;
          batch_id: string;
          workspace_id: string;
          ordinal: number;
          name: string;
          area_ha: number | string;
          boundary: JsonValue;
          crop_type: string | null;
          row_count: number;
          row_numbers: JsonValue;
          legal_land_descriptions: JsonValue;
          split_index: number;
          split_count: number;
          lld_components_list: JsonValue;
          status: "pending" | "committed";
          committed_field_id: string | null;
          commit_action: "created" | "reused" | null;
          committed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          batch_id: string;
          workspace_id: string;
          ordinal: number;
          name: string;
          area_ha: number | string;
          boundary: JsonValue;
          crop_type?: string | null;
          row_count: number;
          row_numbers?: JsonValue;
          legal_land_descriptions?: JsonValue;
          split_index: number;
          split_count: number;
          lld_components_list?: JsonValue;
          status?: "pending" | "committed";
          committed_field_id?: string | null;
          commit_action?: "created" | "reused" | null;
          committed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          batch_id: string;
          workspace_id: string;
          ordinal: number;
          name: string;
          area_ha: number | string;
          boundary: JsonValue;
          crop_type: string | null;
          row_count: number;
          row_numbers: JsonValue;
          legal_land_descriptions: JsonValue;
          split_index: number;
          split_count: number;
          lld_components_list: JsonValue;
          status: "pending" | "committed";
          committed_field_id: string | null;
          commit_action: "created" | "reused" | null;
          committed_at: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      job_dispatches: {
        Row: {
          id: string;
          job_key: string;
          payload: JsonValue;
          status: "queued" | "running" | "completed" | "failed" | "cancelled";
          attempts: number;
          available_at: string;
          locked_at: string | null;
          locked_by: string | null;
          attempt_started_at: string | null;
          last_heartbeat_at: string | null;
          active_phase_key: string | null;
          active_phase_label: string | null;
          active_phase_started_at: string | null;
          last_attempt_duration_ms: number | null;
          progress_pct: number | null;
          progress_message: string | null;
          progress_updated_at: string | null;
          cancel_requested_at: string | null;
          cancel_requested_by: string | null;
          cancel_reason: string | null;
          cancelled_at: string | null;
          completed_at: string | null;
          failed_at: string | null;
          result: JsonValue | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          job_key: string;
          payload?: JsonValue;
          status?: "queued" | "running" | "completed" | "failed" | "cancelled";
          attempts?: number;
          available_at?: string;
          locked_at?: string | null;
          locked_by?: string | null;
          attempt_started_at?: string | null;
          last_heartbeat_at?: string | null;
          active_phase_key?: string | null;
          active_phase_label?: string | null;
          active_phase_started_at?: string | null;
          last_attempt_duration_ms?: number | null;
          progress_pct?: number | null;
          progress_message?: string | null;
          progress_updated_at?: string | null;
          cancel_requested_at?: string | null;
          cancel_requested_by?: string | null;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          completed_at?: string | null;
          failed_at?: string | null;
          result?: JsonValue | null;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          job_key: string;
          payload: JsonValue;
          status: "queued" | "running" | "completed" | "failed" | "cancelled";
          attempts: number;
          available_at: string;
          locked_at: string | null;
          locked_by: string | null;
          attempt_started_at: string | null;
          last_heartbeat_at: string | null;
          active_phase_key: string | null;
          active_phase_label: string | null;
          active_phase_started_at: string | null;
          last_attempt_duration_ms: number | null;
          progress_pct: number | null;
          progress_message: string | null;
          progress_updated_at: string | null;
          cancel_requested_at: string | null;
          cancel_requested_by: string | null;
          cancel_reason: string | null;
          cancelled_at: string | null;
          completed_at: string | null;
          failed_at: string | null;
          result: JsonValue | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      job_dispatch_phase_runs: {
        Row: {
          id: string;
          dispatch_id: string;
          attempt: number;
          phase_key: string;
          phase_label: string;
          status: "running" | "completed" | "failed" | "cancelled" | "interrupted";
          worker_name: string | null;
          started_at: string;
          ended_at: string | null;
          duration_ms: number | null;
          latest_progress_pct: number | null;
          latest_progress_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          dispatch_id: string;
          attempt: number;
          phase_key: string;
          phase_label: string;
          status?: "running" | "completed" | "failed" | "cancelled" | "interrupted";
          worker_name?: string | null;
          started_at?: string;
          ended_at?: string | null;
          duration_ms?: number | null;
          latest_progress_pct?: number | null;
          latest_progress_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          dispatch_id: string;
          attempt: number;
          phase_key: string;
          phase_label: string;
          status: "running" | "completed" | "failed" | "cancelled" | "interrupted";
          worker_name: string | null;
          started_at: string;
          ended_at: string | null;
          duration_ms: number | null;
          latest_progress_pct: number | null;
          latest_progress_message: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      lld_geocode_cache: {
        Row: {
          id: string;
          quarter: string | null;
          section: number;
          township: number;
          range: number;
          meridian: string;
          lld_code: string;
          boundary_geojson: JsonValue;
          centroid_lat: number | string;
          centroid_lng: number | string;
          bbox_north: number | string;
          bbox_south: number | string;
          bbox_east: number | string;
          bbox_west: number | string;
          source_key: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          quarter?: string | null;
          section: number;
          township: number;
          range: number;
          meridian: string;
          lld_code: string;
          boundary_geojson: JsonValue;
          centroid_lat: number | string;
          centroid_lng: number | string;
          bbox_north: number | string;
          bbox_south: number | string;
          bbox_east: number | string;
          bbox_west: number | string;
          source_key?: string;
          created_at?: string;
        };
        Update: Partial<{
          quarter: string | null;
          section: number;
          township: number;
          range: number;
          meridian: string;
          lld_code: string;
          boundary_geojson: JsonValue;
          centroid_lat: number | string;
          centroid_lng: number | string;
          bbox_north: number | string;
          bbox_south: number | string;
          bbox_east: number | string;
          bbox_west: number | string;
          source_key: string;
          created_at: string;
        }>;
        Relationships: [];
      };
    };
    Views: {
      field_weather_latest_observation: {
        Row: {
          id: string;
          workspace_id: string;
          field_id: string;
          observed_at: string;
          source_key: string;
          provider_key: string;
          air_temperature_c: number | string;
          precipitation_mm: number | string;
          wind_speed_kph: number | string;
          relative_humidity_pct: number | string | null;
          soil_moisture_pct: number | string | null;
          evapotranspiration_mm: number | string | null;
          provenance: JsonValue;
          created_at: string;
          updated_at: string;
        };
        Relationships: [];
      };
      field_overview: {
        Row: {
          workspace_id: string;
          id: string;
          name: string;
          area_ha: number | string;
          legal_land_description: string | null;
          label_point_geojson: JsonValue | null;
          latest_moisture_observed_at: string | null;
          latest_root_zone_pct: number | string | null;
          latest_surface_pct: number | string | null;
          latest_moisture_confidence: "low" | "medium" | "high" | null;
          latest_moisture_source_key: string | null;
        };
        Relationships: [];
      };
      job_dispatch_summary: {
        Row: {
          job_key: string;
          status: "queued" | "running" | "completed" | "failed" | "cancelled";
          dispatch_count: number | string;
          oldest_created_at: string | null;
          latest_created_at: string | null;
          latest_updated_at: string | null;
          active_cancellation_count: number | string;
        };
        Relationships: [];
      };
      job_phase_timing_summary: {
        Row: {
          job_key: string;
          phase_key: string;
          phase_label: string;
          run_count: number | string;
          running_count: number | string;
          completed_count: number | string;
          cancelled_count: number | string;
          failed_count: number | string;
          interrupted_count: number | string;
          average_duration_ms: number | string | null;
          min_duration_ms: number | null;
          max_duration_ms: number | null;
          latest_ended_at: string | null;
          latest_updated_at: string | null;
        };
        Relationships: [];
      };
      job_attempt_timeline: {
        Row: {
          dispatch_id: string;
          job_key: string;
          attempt: number;
          attempt_status: "running" | "completed" | "failed" | "cancelled" | "interrupted";
          attempt_started_at: string | null;
          attempt_ended_at: string | null;
          phase_run_count: number | string;
          running_phase_count: number | string;
          completed_phase_count: number | string;
          cancelled_phase_count: number | string;
          failed_phase_count: number | string;
          interrupted_phase_count: number | string;
          total_phase_duration_ms: number | string | null;
          latest_phase_updated_at: string | null;
        };
        Relationships: [];
      };
      job_attempt_timing_summary: {
        Row: {
          job_key: string;
          attempt_status: "running" | "completed" | "failed" | "cancelled" | "interrupted";
          run_count: number | string;
          average_duration_ms: number | string | null;
          min_duration_ms: number | null;
          max_duration_ms: number | null;
          latest_ended_at: string | null;
          latest_updated_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      create_workspace_with_owner_membership: {
        Args: {
          workspace_name: string;
          workspace_slug: string;
          actor_user_id: string;
        };
        Returns: DatabaseSchema["app"]["Tables"]["workspaces"]["Row"][];
      };
      consume_rate_limit: {
        Args: {
          target_scope: string;
          target_identifier: string;
          max_attempts: number;
          window_seconds: number;
        };
        Returns: {
          allowed: boolean;
          limit_count: number;
          remaining_count: number;
          retry_after_seconds: number;
          reset_at: string;
        }[];
      };
      create_field_record: {
        Args: {
          target_workspace_id: string;
          field_name: string;
          field_area_ha: number;
          field_boundary_geojson: JsonValue;
          actor_user_id: string;
        };
        Returns: {
          id: string;
          workspace_id: string;
          name: string;
          area_ha: number | string;
          legal_land_description: string | null;
          boundary_geojson: JsonValue;
          label_point_geojson: JsonValue;
          created_by: string;
          created_at: string;
          updated_at: string;
        }[];
      };
      get_field_detail: {
        Args: {
          target_workspace_id: string;
          target_field_id: string;
        };
        Returns: {
          id: string;
          workspace_id: string;
          name: string;
          area_ha: number | string;
          legal_land_description: string | null;
          boundary_geojson: JsonValue;
          label_point_geojson: JsonValue;
          created_by: string;
          created_at: string;
          updated_at: string;
        }[];
      };
      create_field_import_batch: {
        Args: {
          target_workspace_id: string;
          import_source_type: string;
          import_file_name: string;
          import_sheet_name: string;
          import_row_count: number;
          import_valid_row_count: number;
          import_field_count: number;
          import_issue_count: number;
          import_issues: JsonValue;
          import_candidates: JsonValue;
          actor_user_id: string;
        };
        Returns: {
          id: string;
          workspace_id: string;
          source_type: string;
          file_name: string;
          sheet_name: string;
          status: "previewed" | "committed";
          row_count: number;
          valid_row_count: number;
          field_count: number;
          issue_count: number;
          issues: JsonValue;
          created_by: string;
          committed_by: string | null;
          committed_at: string | null;
          created_at: string;
          updated_at: string;
        }[];
      };
      get_field_import_batch_detail: {
        Args: {
          target_workspace_id: string;
          target_batch_id: string;
        };
        Returns: {
          id: string;
          workspace_id: string;
          source_type: string;
          file_name: string;
          sheet_name: string;
          status: "previewed" | "committed";
          row_count: number;
          valid_row_count: number;
          field_count: number;
          issue_count: number;
          issues: JsonValue;
          created_by: string;
          committed_by: string | null;
          committed_at: string | null;
          created_at: string;
          updated_at: string;
        }[];
      };
      get_field_import_batch_candidates: {
        Args: {
          target_workspace_id: string;
          target_batch_id: string;
        };
        Returns: {
          id: string;
          batch_id: string;
          workspace_id: string;
          ordinal: number;
          name: string;
          area_ha: number | string;
          boundary_geojson: JsonValue;
          crop_type: string | null;
          row_count: number;
          row_numbers: JsonValue;
          legal_land_descriptions: JsonValue;
          split_index: number;
          split_count: number;
          lld_components_list: JsonValue;
          status: "pending" | "committed";
          committed_field_id: string | null;
          commit_action: "created" | "reused" | null;
          committed_at: string | null;
          created_at: string;
          updated_at: string;
        }[];
      };
      mark_field_import_candidate_committed: {
        Args: {
          target_workspace_id: string;
          target_batch_id: string;
          target_candidate_id: string;
          target_field_id: string;
          target_commit_action: string;
        };
        Returns: {
          id: string;
          batch_id: string;
          workspace_id: string;
          ordinal: number;
          name: string;
          area_ha: number | string;
          boundary_geojson: JsonValue;
          crop_type: string | null;
          row_count: number;
          row_numbers: JsonValue;
          legal_land_descriptions: JsonValue;
          split_index: number;
          split_count: number;
          lld_components_list: JsonValue;
          status: "pending" | "committed";
          committed_field_id: string | null;
          commit_action: "created" | "reused" | null;
          committed_at: string | null;
          created_at: string;
          updated_at: string;
        }[];
      };
      mark_field_import_batch_committed: {
        Args: {
          target_workspace_id: string;
          target_batch_id: string;
          actor_user_id: string;
        };
        Returns: {
          id: string;
          workspace_id: string;
          source_type: string;
          file_name: string;
          sheet_name: string;
          status: "previewed" | "committed";
          row_count: number;
          valid_row_count: number;
          field_count: number;
          issue_count: number;
          issues: JsonValue;
          created_by: string;
          committed_by: string | null;
          committed_at: string | null;
          created_at: string;
          updated_at: string;
        }[];
      };
      claim_next_job_dispatch: {
        Args: {
          worker_name: string;
          stale_after_seconds: number;
          job_keys?: string[] | null;
        };
        Returns: {
          id: string;
          job_key: string;
          payload: JsonValue;
          status: "queued" | "running" | "completed" | "failed" | "cancelled";
          attempts: number;
          available_at: string;
          locked_at: string | null;
          locked_by: string | null;
          attempt_started_at: string | null;
          last_heartbeat_at: string | null;
          active_phase_key: string | null;
          active_phase_label: string | null;
          active_phase_started_at: string | null;
          last_attempt_duration_ms: number | null;
          progress_pct: number | null;
          progress_message: string | null;
          progress_updated_at: string | null;
          cancel_requested_at: string | null;
          cancel_requested_by: string | null;
          cancel_reason: string | null;
          cancelled_at: string | null;
          completed_at: string | null;
          failed_at: string | null;
          result: JsonValue | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        }[];
      };
      get_job_queue_health: {
        Args: {
          stale_after_seconds?: number;
        };
        Returns: {
          total_count: number | string;
          queued_count: number | string;
          running_count: number | string;
          completed_count: number | string;
          failed_count: number | string;
          cancelled_count: number | string;
          stale_running_count: number | string;
          cancellation_requested_count: number | string;
          oldest_queued_at: string | null;
          oldest_running_at: string | null;
          latest_updated_at: string | null;
        }[];
      };
      lookup_lld_geocode: {
        Args: {
          target_quarter: string | null;
          target_section: number;
          target_township: number;
          target_range: number;
          target_meridian: string;
        };
        Returns: {
          lld_code: string;
          boundary_geojson: JsonValue;
          centroid_lat: number | string;
          centroid_lng: number | string;
          bbox_north: number | string;
          bbox_south: number | string;
          bbox_east: number | string;
          bbox_west: number | string;
        }[];
      };
      replay_field_hydration_from_source: {
        Args: {
          source_field_id: string;
          target_workspace_id: string;
          target_field_id: string;
          target_crop_type?: string | null;
        };
        Returns: {
          copied_crop_context: boolean;
          weather_observation_count: number;
          weather_forecast_count: number;
          weather_signal_set: boolean;
          moisture_snapshot_count: number;
          moisture_cell_count: number;
          raster_observation: boolean;
        }[];
      };
      replay_field_hydration_from_import_candidate: {
        Args: {
          target_workspace_id: string;
          target_field_id: string;
          target_field_name: string;
          target_legal_land_descriptions?: string[] | null;
          target_crop_type?: string | null;
        };
        Returns: {
          action: string;
          reason: string | null;
          source_field_id: string | null;
          source_workspace_id: string | null;
          source_workspace_slug: string | null;
          copied_crop_context: boolean;
          weather_observation_count: number;
          weather_forecast_count: number;
          weather_signal_set: boolean;
          moisture_snapshot_count: number;
          moisture_cell_count: number;
          raster_observation: boolean;
        }[];
      };
      replay_field_hydration_from_committed_batch: {
        Args: {
          target_workspace_id: string;
          target_batch_id: string;
        };
        Returns: {
          target_field_id: string;
          action: string;
          reason: string | null;
          source_field_id: string | null;
          source_workspace_id: string | null;
          source_workspace_slug: string | null;
          copied_crop_context: boolean;
          weather_observation_count: number;
          weather_forecast_count: number;
          weather_signal_set: boolean;
          moisture_snapshot_count: number;
          moisture_cell_count: number;
          raster_observation: boolean;
        }[];
      };
    };
    Enums: {
      workspace_role: "owner" | "manager" | "member" | "viewer";
      moisture_confidence: "low" | "medium" | "high";
      field_import_batch_status: "previewed" | "committed";
      field_import_candidate_status: "pending" | "committed";
      job_phase_run_status:
        | "running"
        | "completed"
        | "failed"
        | "cancelled"
        | "interrupted";
      job_dispatch_status:
        | "queued"
        | "running"
        | "completed"
        | "failed"
        | "cancelled";
    };
  };
};
