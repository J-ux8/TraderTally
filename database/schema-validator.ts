import * as SQLite from 'expo-sqlite';

/**
 * Schema validation utilities to ensure all tables have required sync metadata columns.
 */

interface ColumnInfo {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Required sync metadata columns for all synchronized tables
 */
const REQUIRED_SYNC_COLUMNS = [
  { name: 'id', type: 'TEXT' },
  { name: 'user_id', type: 'TEXT' },
  { name: 'created_at', type: 'TEXT' },
  { name: 'updated_at', type: 'TEXT' },
  { name: 'is_deleted', type: 'INTEGER' },
  { name: 'sync_status', type: 'TEXT' },
  { name: 'sync_version', type: 'INTEGER' },
  { name: 'retry_count', type: 'INTEGER' },
];

/**
 * Required indexes for performance
 */
const REQUIRED_INDEXES = [
  { table: 'transactions', column: 'user_id', name: 'idx_transactions_user_id' },
  { table: 'transactions', column: 'sync_status', name: 'idx_transactions_sync_status' },
  { table: 'transactions', column: 'updated_at', name: 'idx_transactions_updated_at' },
  { table: 'categories', column: 'user_id', name: 'idx_categories_user_id' },
  { table: 'categories', column: 'sync_status', name: 'idx_categories_sync_status' },
  { table: 'categories', column: 'updated_at', name: 'idx_categories_updated_at' },
  { table: 'debts', column: 'user_id', name: 'idx_debts_user_id' },
  { table: 'debts', column: 'sync_status', name: 'idx_debts_sync_status' },
  { table: 'debts', column: 'updated_at', name: 'idx_debts_updated_at' },
];

/**
 * Tables that should have sync metadata
 */
const SYNC_TABLES = ['transactions', 'categories', 'debts'];

/**
 * Validate that a table has all required sync metadata columns
 */
async function validateTableColumns(
  database: SQLite.SQLiteDatabase,
  tableName: string
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Get table info
    const columns = await database.getAllAsync(
      `PRAGMA table_info(${tableName})`
    ) as ColumnInfo[];

    if (columns.length === 0) {
      errors.push(`Table ${tableName} does not exist`);
      return { valid: false, errors, warnings };
    }

    // Check each required column
    for (const required of REQUIRED_SYNC_COLUMNS) {
      const column = columns.find(col => col.name === required.name);
      
      if (!column) {
        errors.push(`Table ${tableName} missing required column: ${required.name}`);
      } else if (!column.type.toUpperCase().includes(required.type.toUpperCase())) {
        warnings.push(
          `Table ${tableName} column ${required.name} has type ${column.type}, expected ${required.type}`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (error) {
    errors.push(`Error validating table ${tableName}: ${error}`);
    return { valid: false, errors, warnings };
  }
}

/**
 * Validate that required indexes exist
 */
async function validateIndexes(
  database: SQLite.SQLiteDatabase
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Get all indexes
    const indexes = await database.getAllAsync(
      `SELECT name, tbl_name FROM sqlite_master WHERE type='index'`
    ) as { name: string; tbl_name: string }[];

    // Check each required index
    for (const required of REQUIRED_INDEXES) {
      const exists = indexes.some(idx => idx.name === required.name);
      
      if (!exists) {
        warnings.push(
          `Missing performance index: ${required.name} on ${required.table}(${required.column})`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (error) {
    errors.push(`Error validating indexes: ${error}`);
    return { valid: false, errors, warnings };
  }
}

/**
 * Validate sync_metadata table structure
 */
async function validateSyncMetadata(
  database: SQLite.SQLiteDatabase
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const columns = await database.getAllAsync(
      `PRAGMA table_info(sync_metadata)`
    ) as ColumnInfo[];

    if (columns.length === 0) {
      errors.push('sync_metadata table does not exist');
      return { valid: false, errors, warnings };
    }

    // Check required columns
    const requiredColumns = ['user_id', 'last_sync_time', 'last_push_time', 'device_id'];
    for (const colName of requiredColumns) {
      const exists = columns.some(col => col.name === colName);
      if (!exists) {
        errors.push(`sync_metadata table missing required column: ${colName}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (error) {
    errors.push(`Error validating sync_metadata: ${error}`);
    return { valid: false, errors, warnings };
  }
}

/**
 * Validate entire database schema for sync support
 */
export async function validateSyncSchema(
  database: SQLite.SQLiteDatabase
): Promise<ValidationResult> {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  console.log('[SchemaValidator] Starting schema validation...');

  // Validate sync_metadata table
  const metadataResult = await validateSyncMetadata(database);
  allErrors.push(...metadataResult.errors);
  allWarnings.push(...metadataResult.warnings);

  // Validate each sync table
  for (const table of SYNC_TABLES) {
    const tableResult = await validateTableColumns(database, table);
    allErrors.push(...tableResult.errors);
    allWarnings.push(...tableResult.warnings);
  }

  // Validate indexes
  const indexResult = await validateIndexes(database);
  allErrors.push(...indexResult.errors);
  allWarnings.push(...indexResult.warnings);

  // Log results
  if (allErrors.length > 0) {
    console.error('[SchemaValidator] Validation FAILED with errors:');
    allErrors.forEach(err => console.error(`  - ${err}`));
  }

  if (allWarnings.length > 0) {
    console.warn('[SchemaValidator] Validation warnings:');
    allWarnings.forEach(warn => console.warn(`  - ${warn}`));
  }

  if (allErrors.length === 0 && allWarnings.length === 0) {
    console.log('[SchemaValidator] Schema validation PASSED');
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

/**
 * Get detailed column information for a table
 */
export async function getTableColumns(
  database: SQLite.SQLiteDatabase,
  tableName: string
): Promise<ColumnInfo[]> {
  return await database.getAllAsync(
    `PRAGMA table_info(${tableName})`
  ) as ColumnInfo[];
}

/**
 * Check if a specific column exists in a table
 */
export async function hasColumn(
  database: SQLite.SQLiteDatabase,
  tableName: string,
  columnName: string
): Promise<boolean> {
  const columns = await getTableColumns(database, tableName);
  return columns.some(col => col.name === columnName);
}
