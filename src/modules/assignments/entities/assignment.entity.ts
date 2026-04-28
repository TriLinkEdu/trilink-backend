import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum SubmissionType {
  FILE = 'file',       // student uploads a file
  TEXT = 'text',       // student types a response
  NONE = 'none',       // no submission required (informational only)
}

@Entity('assignments')
export class Assignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'class_offering_id', type: 'uuid' })
  classOfferingId: string;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'submission_type', type: 'simple-enum', enum: SubmissionType, default: SubmissionType.FILE })
  submissionType: SubmissionType;

  /** Optional file the teacher attaches (e.g. worksheet PDF) */
  @Column({ name: 'attachment_file_id', type: 'uuid', nullable: true })
  attachmentFileId: string | null;

  @Column({ name: 'deadline', type: 'timestamp' })
  deadline: Date;

  @Column({ name: 'max_score', type: 'float', default: 100 })
  maxScore: number;

  /** Whether the assignment is visible to students */
  @Column({ type: 'boolean', default: false })
  published: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
