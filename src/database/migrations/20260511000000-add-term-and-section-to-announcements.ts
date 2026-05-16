import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTermAndSectionToAnnouncements20260511000000 implements MigrationInterface {
  name = 'AddTermAndSectionToAnnouncements20260511000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "target_section" varchar(40)`);
    await queryRunner.query(`ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "term_id" uuid`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_announcements_term_id" ON "announcements" ("term_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_announcements_target_section" ON "announcements" ("target_section")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_announcements_target_section"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_announcements_term_id"`);
    await queryRunner.query(`ALTER TABLE "announcements" DROP COLUMN IF EXISTS "term_id"`);
    await queryRunner.query(`ALTER TABLE "announcements" DROP COLUMN IF EXISTS "target_section"`);
  }
}
