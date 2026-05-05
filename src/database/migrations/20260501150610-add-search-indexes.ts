import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSearchIndexes20260501150610 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add GIN index on users table for full-text search on first_name, last_name, and email
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_fulltext_search" 
      ON "users" 
      USING gin(
        to_tsvector('english', 
          coalesce(first_name, '') || ' ' || 
          coalesce(last_name, '') || ' ' || 
          coalesce(email, '')
        )
      )
    `);

    // Add GIN index on subjects table for full-text search on name and code
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_subjects_fulltext_search" 
      ON "subjects" 
      USING gin(
        to_tsvector('english', 
          coalesce(name, '') || ' ' || 
          coalesce(code, '')
        )
      )
    `);

    // Add indexes on class_offerings for search performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_class_offerings_name" 
      ON "class_offerings" ("name")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_class_offerings_subject_id" 
      ON "class_offerings" ("subject_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_class_offerings_grade_id" 
      ON "class_offerings" ("grade_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_class_offerings_section_id" 
      ON "class_offerings" ("section_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop all search indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_fulltext_search"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_subjects_fulltext_search"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_class_offerings_name"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_class_offerings_subject_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_class_offerings_grade_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_class_offerings_section_id"`);
  }
}
