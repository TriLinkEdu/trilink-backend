import { MigrationInterface, QueryRunner } from 'typeorm';

export class RevertAchievementsNameToTitle20260516000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'achievements' AND column_name = 'name'
        ) THEN
          ALTER TABLE achievements RENAME COLUMN name TO title;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'achievements' AND column_name = 'title'
        ) THEN
          ALTER TABLE achievements RENAME COLUMN title TO name;
        END IF;
      END $$;
    `);
  }
}
