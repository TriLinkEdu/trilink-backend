import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('exam_attempts')
@Index(['examId', 'studentId'], { unique: true })
export class ExamAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'exam_id', type: 'uuid' })
  examId: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @Column({ name: 'started_at', type: 'timestamp' })
  startedAt: Date;

  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'answers_json', type: 'text', default: '{}' })
  answersJson: string;

  @Column({ type: 'float', nullable: true })
  score: number | null;

  /** Proportional score from auto-gradable items before teacher override. */
  @Column({ name: 'auto_score', type: 'float', nullable: true })
  autoScore: number | null;

  @Column({ name: 'breakdown_json', type: 'text', nullable: true })
  breakdownJson: string | null;

  @Column({ name: 'needs_manual_grading', type: 'boolean', default: false })
  needsManualGrading: boolean;

  @Column({ name: 'released_at', type: 'timestamp', nullable: true })
  releasedAt: Date | null;

  @Column({ name: 'graded_by_id', type: 'uuid', nullable: true })
  gradedById: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
