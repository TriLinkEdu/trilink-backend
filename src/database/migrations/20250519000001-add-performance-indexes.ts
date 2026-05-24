import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Performance indexes for frequently queried columns
 * - Reduces query time from 200ms+ to <10ms for large tables
 * - Critical for dashboard, attendance, and textbook queries
 */
export class AddPerformanceIndexes20250519000001 implements MigrationInterface {
  name = 'AddPerformanceIndexes20250519000001';

  public async up(_queryRunner: QueryRunner): Promise<void> {
    // no-op: indexes reference wrong column names (due_date vs deadline) and
    // tables that don't exist when this 2025-timestamped migration runs first.
    // Core indexes are already created by 20260506130000-complete-mvp-production-schema.
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // no-op
  }
}
