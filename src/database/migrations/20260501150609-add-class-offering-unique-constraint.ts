import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class AddClassOfferingUniqueConstraint20260501150609 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add unique constraint on class_offerings table
    await queryRunner.createIndex(
      'class_offerings',
      new TableIndex({
        name: 'IDX_class_offering_unique',
        columnNames: ['academic_year_id', 'grade_id', 'section_id', 'subject_id'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the unique constraint
    await queryRunner.dropIndex('class_offerings', 'IDX_class_offering_unique');
  }
}
