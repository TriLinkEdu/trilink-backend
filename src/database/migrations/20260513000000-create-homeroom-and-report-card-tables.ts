import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHomeroomAndReportCardTables20260513000000
  implements MigrationInterface
{
  name = 'CreateHomeroomAndReportCardTables20260513000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── homeroom_assignments ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "homeroom_assignments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "teacher_id" uuid NOT NULL,
        "academic_year_id" uuid NOT NULL,
        "grade_id" uuid NOT NULL,
        "section_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_homeroom_assignments_year_grade_section"
        ON "homeroom_assignments" ("academic_year_id", "grade_id", "section_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_homeroom_assignments_teacher_year"
        ON "homeroom_assignments" ("teacher_id", "academic_year_id")
    `);

    // ─── report_card_remarks ────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "report_card_remarks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "student_id" uuid NOT NULL,
        "term_id" uuid NOT NULL,
        "academic_year_id" uuid NOT NULL,
        "homeroom_teacher_id" uuid NOT NULL,
        "remark" text NOT NULL,
        "conduct_grade" varchar(10),
        "attendance_summary" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_report_card_remarks_student_term"
        ON "report_card_remarks" ("student_id", "term_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_report_card_remarks_year"
        ON "report_card_remarks" ("academic_year_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_report_card_remarks_year"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_report_card_remarks_student_term"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "report_card_remarks"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_homeroom_assignments_teacher_year"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_homeroom_assignments_year_grade_section"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "homeroom_assignments"`);
  }
}
