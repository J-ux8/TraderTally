/**
 * Database utilities for offline-first sync system
 */

export { migrateDatabase } from './migrations';
export { SCHEMA } from './schema';
export { 
  validateSyncSchema, 
  getTableColumns, 
  hasColumn 
} from './schema-validator';
export { 
  getOrCreateDeviceId, 
  clearDeviceIdCache, 
  hasDeviceId 
} from './device-id';
