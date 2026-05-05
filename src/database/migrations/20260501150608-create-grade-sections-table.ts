import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateGradeSectionsTable20260501150608 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create grade_sections table
    await queryRunner.createTable(
      new Table({
        name: 'grade_sections',
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
            name: 'section_id',
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

    // Add foreign key to grades table
    await queryRunner.createForeignKey(
      'grade_sections',
      new TableForeignKey({
        columnNames: ['grade_id'],
        referencedTableName: 'grades',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Add foreign key to sections table
    await queryRunner.createForeignKey(
      'grade_sections',
      new TableForeignKey({
        columnNames: ['section_id'],
        referencedTableName: 'sections',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Add unique constraint on grade_id + section_id
    await queryRunner.createIndex(
      'grade_sections',
      new TableIndex({
        name: 'IDX_grade_section_unique',
        columnNames: ['grade_id', 'section_id'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the table (foreign keys and indexes will be dropped automatically)
    await queryRunner.dropTable('grade_sections');
  }
}
