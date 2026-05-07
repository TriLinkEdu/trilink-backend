import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixChatMessageTextNullable20260506184500 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE chat_messages ALTER COLUMN text DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE chat_messages SET text = '' WHERE text IS NULL`);
    await queryRunner.query(`ALTER TABLE chat_messages ALTER COLUMN text SET NOT NULL`);
  }
}
