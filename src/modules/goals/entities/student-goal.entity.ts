import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('student_goals')
export class StudentGoal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'target_date', type: 'varchar', length: 32, nullable: true })
  targetDate: string | null;

  /** active | completed | abandoned */
  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @Column({ name: 'progress_percent', type: 'int', default: 0 })
  progressPercent: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
