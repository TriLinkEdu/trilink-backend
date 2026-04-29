import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum SubmissionStatus {
  PENDING = 'pending',       // not yet submitted
  SUBMITTED = 'submitted',   // student submitted
  GRADED = 'graded',         // teacher graded
  RETURNED = 'returned',     // grade released to student
}

@Entity('assignment_submissions')
@Index(['assignmentId', 'studentId'], { unique: true })
export class AssignmentSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'assignment_id', type: 'uuid' })
  assignmentId: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @Column({ type: 'simple-enum', enum: SubmissionStatus, default: SubmissionStatus.PENDING })
  status: SubmissionStatus;

  /** For file submissions — the uploaded file ID */
  @Column({ name: 'file_id', type: 'uuid', nullable: true })
  fileId: string | null;

  /** For text submissions */
  @Column({ name: 'text_content', type: 'text', nullable: true })
  textContent: string | null;

  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true })
  submittedAt: Date | null;

  /** Score given by teacher */
  @Column({ type: 'float', nullable: true })
  score: number | null;

  /** Teacher feedback */
  @Column({ type: 'text', nullable: true })
  feedback: string | null;

  /** When the grade was released to the student */
  @Column({ name: 'released_at', type: 'timestamp', nullable: true })
  releasedAt: Date | null;

  @Column({ name: 'graded_by_id', type: 'uuid', nullable: true })
  gradedById: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
