import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type EnrollmentStatus = 'active' | 'transferred' | 'completed';

@Entity('enrollments')
@Index(['studentId', 'classOfferingId'], { unique: true })
export class Enrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @Column({ name: 'class_offering_id', type: 'uuid' })
  classOfferingId: string;

  @Column({ name: 'academic_year_id', type: 'uuid' })
  academicYearId: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: EnrollmentStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
