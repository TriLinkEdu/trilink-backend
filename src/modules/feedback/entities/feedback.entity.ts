import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum FeedbackType {
  TEACHER = 'teacher',       // student/parent → specific teacher
  SCHOOL = 'school',         // teacher → school administration
  GENERAL = 'general',       // any → general
}

/**
 * Who is sending and who is the target.
 * senderRole + recipientId/teacherId together describe the feedback direction.
 */
export enum FeedbackSenderRole {
  STUDENT = 'student',
  PARENT = 'parent',
  TEACHER = 'teacher',
}

@Entity('feedbacks')
export class Feedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Null when submission is anonymous. */
  @Column({ name: 'author_id', type: 'uuid', nullable: true })
  authorId: string | null;

  /** Role of the sender at submission time (stored even when anonymous for admin filtering). */
  @Column({ name: 'sender_role', type: 'varchar', length: 20, nullable: true })
  senderRole: FeedbackSenderRole | null;

  @Column({ type: 'simple-enum', enum: FeedbackType, default: FeedbackType.GENERAL })
  category: FeedbackType;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 40, default: 'open' })
  status: string;

  @Column({ name: 'assignee_id', type: 'uuid', nullable: true })
  assigneeId: string | null;

  /** Subject the feedback relates to (optional). */
  @Column({ name: 'subject_id', type: 'uuid', nullable: true })
  subjectId: string | null;

  /**
   * The teacher this feedback is directed at.
   * Required when category = 'teacher'.
   */
  @Column({ name: 'teacher_id', type: 'uuid', nullable: true })
  teacherId: string | null;

  @Column({ name: 'is_anonymous', type: 'boolean', default: false })
  isAnonymous: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
