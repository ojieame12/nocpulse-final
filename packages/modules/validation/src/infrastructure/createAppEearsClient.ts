/**
 * Interface for fetching NASA SMAP L4 root-zone soil moisture data.
 *
 * The production implementation will use the AppEEARS (Application for
 * Extracting and Exploring Analysis Ready Samples) REST API, which
 * requires NASA Earthdata credentials and async task polling (tasks
 * typically take 5-15 minutes to complete).
 *
 * For initial development and CI usage, a CSV fixture loader is provided
 * that reads pre-downloaded SMAP data from local files.
 */

export type SmapObservation = {
  date: string; // ISO date string (YYYY-MM-DD)
  rootZonePct: number; // Volumetric water content (%)
};

export type SmapDataSource = {
  /**
   * Fetch SMAP root-zone soil moisture for a given coordinate and date range.
   *
   * @param lat  Latitude of the point (WGS84)
   * @param lng  Longitude of the point (WGS84)
   * @param startDate  Start of the date range (YYYY-MM-DD)
   * @param endDate    End of the date range (YYYY-MM-DD)
   * @returns Array of daily observations within the date range
   */
  fetchSmapTimeseries(
    lat: number,
    lng: number,
    startDate: string,
    endDate: string,
  ): Promise<SmapObservation[]>;
};

// ---------------------------------------------------------------------------
// CSV fixture loader
// ---------------------------------------------------------------------------

/**
 * CSV fixture format (one row per day):
 *
 *   date,root_zone_sm_pct
 *   2024-01-01,32.4
 *   2024-01-02,31.8
 *   ...
 *
 * The fixture file is keyed by field ID; pass the path when creating.
 */
export function createCsvFixtureSmapSource(csvPath: string): SmapDataSource {
  return {
    async fetchSmapTimeseries(
      _lat: number,
      _lng: number,
      startDate: string,
      endDate: string,
    ): Promise<SmapObservation[]> {
      const { readFile } = await import("node:fs/promises");

      const raw = await readFile(csvPath, "utf-8");
      const lines = raw.trim().split("\n");

      // Skip header
      const observations: SmapObservation[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const [date, valueStr] = line.split(",");
        if (!date || !valueStr) continue;

        const rootZonePct = parseFloat(valueStr);
        if (!Number.isFinite(rootZonePct)) continue;

        // Filter to requested date range
        if (date >= startDate && date <= endDate) {
          observations.push({ date, rootZonePct });
        }
      }

      return observations;
    },
  };
}

// ---------------------------------------------------------------------------
// TODO: Real AppEEARS integration
// ---------------------------------------------------------------------------

/**
 * TODO: Implement real AppEEARS client.
 *
 * Steps required:
 * 1. Authenticate with NASA Earthdata via AppEEARS /login endpoint
 *    using EARTHDATA_USERNAME / EARTHDATA_PASSWORD credentials.
 * 2. Submit a point sample task for SPL4SMGP.007 (SMAP L4 Global
 *    root-zone soil moisture) at the given coordinate and date range.
 * 3. Poll task status until complete (typically 5-15 min).
 * 4. Download results and parse the SMAP sm_rootzone field.
 * 5. Convert from volumetric fraction (m3/m3) to percentage.
 *
 * Environment variables:
 *   EARTHDATA_USERNAME   — NASA Earthdata login
 *   EARTHDATA_PASSWORD   — NASA Earthdata password
 *   APPEEARS_BASE_URL    — Base URL (default: https://appeears.earthdatacloud.nasa.gov/api)
 */
export function createAppEearsSmapSource(
  _username: string,
  _password: string,
  _baseUrl?: string,
): SmapDataSource {
  return {
    async fetchSmapTimeseries(): Promise<SmapObservation[]> {
      throw new Error(
        "[smap-validation] AppEEARS integration is not yet implemented. " +
          "Use CSV fixture mode for now.",
      );
    },
  };
}
