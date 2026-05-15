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

  /** Snapshot of the exam max points at attempt time. */
  @Column({ name: 'max_points_snapshot', type: 'int', nullable: true })
  maxPointsSnapshot: number | null;

  /** Proportional score from auto-gradable items before teacher override. */
  @Column({ name: 'auto_score', type: 'float', nullable: true })
  autoScore: number | null;

  @Column({ name: 'breakdown_json', type: 'text', nullable: true })
  breakdownJson: string | null;

  /** JSON array of { reason: string, timestamp: string } — tab-switch / focus-loss events */
  @Column({ name: 'violations_json', type: 'text', nullable: true })
  violationsJson: string | null;

  /** Locked attempts cannot be resumed until a teacher explicitly allows rejoin. */
  @Column({ name: 'is_locked', type: 'boolean', default: false })
  isLocked: boolean;

  @Column({ name: 'lock_reason', type: 'varchar', length: 255, nullable: true })
  lockReason: string | null;

  @Column({ name: 'locked_at', type: 'timestamp', nullable: true })
  lockedAt: Date | null;

  /** One-time override granted by teacher to resume a locked attempt. */
  @Column({ name: 'reentry_allowed', type: 'boolean', default: false })
  reentryAllowed: boolean;

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
