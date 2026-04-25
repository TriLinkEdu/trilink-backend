import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('assignment_submissions')
@Index(['assignmentId', 'studentId'], { unique: true })
export class AssignmentSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'assignment_id', type: 'uuid' })
  assignmentId: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'float', nullable: true })
  score: number | null;

  @Column({ name: 'feedback_text', type: 'text', nullable: true })
  feedbackText: string | null;

  @Column({ name: 'submitted_at', type: 'timestamp' })
  submittedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
