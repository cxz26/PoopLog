/**
 * Public database entry-point.
 * Re-exports connection helpers, migrations, repositories, and test hooks.
 */

export { initDatabase, getDatabase, closeDatabase, getAppliedMigrations, withTransaction, dbExecute, dbSelect, __setTestDatabase, __getTestDatabase } from "./connection";
export { migrations } from "./migrations";
export type { Migration } from "./migrations";
export * as Repos from "./repositories";
