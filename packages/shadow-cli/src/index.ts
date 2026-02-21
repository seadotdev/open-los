/**
 * Shadow CLI - System of Record Abstraction Layer
 *
 * Provides bidirectional sync between Open LOS and external lending
 * platforms (Salesforce, HubSpot, nCino, Mambu, etc.).
 *
 * The shadow CLI runs alongside the lender's existing system of record,
 * proving the value of Open LOS before any migration conversation.
 *
 * Exports:
 * - Adapter interface and implementations
 * - Sync engine (plan generation, execution, conflict resolution)
 * - Mapping engine (field discovery and matching)
 * - CLI command registration
 */

// Adapter types and interface
export type {
  ShadowAdapter,
  AdapterType,
  AdapterCapabilities,
  AdapterConfig,
  SalesforceConfig,
  HubSpotConfig,
  NcinoConfig,
  MambuConfig,
  GenericRestConfig,
  ExternalSchema,
  ExternalObjectSchema,
  ExternalFieldSchema,
  ExternalDataType,
  ExternalRecord,
  FieldMapping,
  FieldMappingSuggestion,
  CanonicalEntity,
  TransformRule,
  TransformType,
  FetchQuery,
  FetchResult,
  PushResult,
  BatchPushResult,
  ChangeEvent,
  WatchHandle,
  ConnectionTestResult,
} from "./adapters/types.js";

// Sync engine types
export type {
  FieldProvenance,
  SyncRecord,
  SyncStatus,
  SyncPlan,
  SyncPlanSummary,
  SyncOperation,
  FieldChange,
  SyncConflict,
  ConflictResolution,
  ConflictStrategy,
  SyncResult,
  SyncOperationResult,
  SyncError,
  ConnectionProfile,
  ShadowPhase,
  ShadowStatus,
  ConnectionSummary,
} from "./sync/types.js";

// Adapter implementations
export { SalesforceAdapter } from "./adapters/salesforce.js";
export { HubSpotAdapter } from "./adapters/hubspot.js";

// Mapping engine
export {
  OBJECT_MAPPINGS,
  FIELD_PATTERNS,
  STAGE_NORMALIZATION,
  suggestEntityMapping,
  suggestFieldMapping,
  generateMappingProposal,
} from "./adapters/mapping-engine.js";

// Sync plan generation
export { generateSyncPlan } from "./sync/plan.js";
export type { PlanOptions, ShadowLedger } from "./sync/plan.js";

// CLI commands
export { registerShadowCommands } from "./commands/shadow.js";
