import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixAchievementsColumnName20260515000001 implements MigrationInterface {
  public async up(_queryRunner: QueryRunner): Promise<void> {
    // no-op: column rename abandoned; entity now maps to existing 'title' column
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // no-op
  }
}
