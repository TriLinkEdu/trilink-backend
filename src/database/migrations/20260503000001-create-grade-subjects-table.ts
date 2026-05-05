import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateGradeSubjectsTable20260503000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'grade_subjects',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'grade_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'subject_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'grade_subjects',
      new TableForeignKey({
        columnNames: ['grade_id'],
        referencedTableName: 'grades',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'grade_subjects',
      new TableForeignKey({
        columnNames: ['subject_id'],
        referencedTableName: 'subjects',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'grade_subjects',
      new TableIndex({
        name: 'IDX_grade_subject_unique',
        columnNames: ['grade_id', 'subject_id'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('grade_subjects');
  }
}
