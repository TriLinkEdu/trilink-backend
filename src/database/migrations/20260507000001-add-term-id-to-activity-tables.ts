import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTermIdToActivityTables20260507000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "grade_entries" ADD COLUMN IF NOT EXISTS "term_id" uuid NULL`);
    await queryRunner.query(`ALTER TABLE "attendance_sessions" ADD COLUMN IF NOT EXISTS "term_id" uuid NULL`);
    await queryRunner.query(`ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "term_id" uuid NULL`);
    await queryRunner.query(`ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "term_id" uuid NULL`);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_grade_entries_term_id" ON "grade_entries" ("term_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_attendance_sessions_term_id" ON "attendance_sessions" ("term_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_exams_term_id" ON "exams" ("term_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_assignments_term_id" ON "assignments" ("term_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "grade_entries" DROP COLUMN IF EXISTS "term_id"`);
    await queryRunner.query(`ALTER TABLE "attendance_sessions" DROP COLUMN IF EXISTS "term_id"`);
    await queryRunner.query(`ALTER TABLE "exams" DROP COLUMN IF EXISTS "term_id"`);
    await queryRunner.query(`ALTER TABLE "assignments" DROP COLUMN IF EXISTS "term_id"`);
  }
}
