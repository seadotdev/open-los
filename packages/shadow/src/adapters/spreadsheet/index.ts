/**
 * Spreadsheet Sync Engine
 *
 * Exports for syncing data from spreadsheet-based LOS systems
 * (Excel, Google Sheets, SharePoint) to Open LOS.
 */

// Core types
export * from "./types";

// Field variations and mapping helpers
export {
  FIELD_VARIATIONS,
  STAGE_NORMALIZATION_MAP,
  findBestFieldMapping,
  normalizeStageValue,
  getVariationsForField,
  getVariationsByCategory,
  type FieldVariation,
  type FieldCategory,
} from "./field-variations";

// Adapters
export { ExcelAdapter, registerExcelAdapter } from "./excel-adapter";
export { GoogleSheetsAdapter, registerGoogleSheetsAdapter } from "./google-sheets-adapter";
export { SharePointAdapter, registerSharePointAdapter } from "./sharepoint-adapter";

// Sync engine
export {
  SpreadsheetSyncEngine,
  createSpreadsheetSyncEngine,
  type SpreadsheetSyncEngineConfig,
  type DatabaseInterface,
  type MappedRecord,
} from "./sync-engine";

// =============================================================================
// Convenience factory for creating adapters
// =============================================================================

import { SpreadsheetAdapter, SpreadsheetConnectionConfig } from "./types";
import { ExcelAdapter, registerExcelAdapter } from "./excel-adapter";
import { GoogleSheetsAdapter, registerGoogleSheetsAdapter } from "./google-sheets-adapter";
import { SharePointAdapter, registerSharePointAdapter } from "./sharepoint-adapter";

/**
 * Create an adapter based on connection configuration
 */
export function createSpreadsheetAdapter(
  config: SpreadsheetConnectionConfig
): SpreadsheetAdapter {
  switch (config.type) {
    case "excel":
      return new ExcelAdapter();
    case "google_sheets":
      return new GoogleSheetsAdapter();
    case "sharepoint":
      return new SharePointAdapter();
    default:
      throw new Error(`Unknown spreadsheet connection type: ${(config as any).type}`);
  }
}

/**
 * Register all spreadsheet adapters
 */
export function registerAllSpreadsheetAdapters(): void {
  registerExcelAdapter();
  registerGoogleSheetsAdapter();
  registerSharePointAdapter();
}
