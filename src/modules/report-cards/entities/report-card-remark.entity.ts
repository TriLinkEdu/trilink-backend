import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('report_card_remarks')
@Index(['studentId', 'termId'], { unique: true })
export class ReportCardRemark {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @Column({ name: 'term_id', type: 'uuid' })
  termId: string;

  @Column({ name: 'academic_year_id', type: 'uuid' })
  academicYearId: string;

  @Column({ name: 'homeroom_teacher_id', type: 'uuid' })
  homeroomTeacherId: string;

  /** Homeroom teacher's overall remark for the student */
  @Column({ type: 'text' })
  remark: string;

  /** e.g. "A", "B+", "Excellent" */
  @Column({ name: 'conduct_grade', type: 'varchar', length: 10, nullable: true })
  conductGrade: string | null;

  /** Cached attendance summary: { present, absent, late, total } */
  @Column({ name: 'attendance_summary', type: 'jsonb', nullable: true })
  attendanceSummary: Record<string, number> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
