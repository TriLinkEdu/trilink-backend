import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('homeroom_assignments')
@Index(['academicYearId', 'gradeId', 'sectionId'], { unique: true })
export class HomeroomAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The homeroom teacher */
  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @Column({ name: 'academic_year_id', type: 'uuid' })
  academicYearId: string;

  @Column({ name: 'grade_id', type: 'uuid' })
  gradeId: string;

  @Column({ name: 'section_id', type: 'uuid' })
  sectionId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
