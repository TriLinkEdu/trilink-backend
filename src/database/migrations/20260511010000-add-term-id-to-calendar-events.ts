import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTermIdToCalendarEvents20260511010000 implements MigrationInterface {
  name = 'AddTermIdToCalendarEvents20260511010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \"calendar_events\" ADD COLUMN IF NOT EXISTS \"term_id\" uuid`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS \"IDX_calendar_events_term_id\" ON \"calendar_events\" (\"term_id\")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS \"IDX_calendar_events_term_id\"`);
    await queryRunner.query(`ALTER TABLE \"calendar_events\" DROP COLUMN IF EXISTS \"term_id\"`);
  }
}
