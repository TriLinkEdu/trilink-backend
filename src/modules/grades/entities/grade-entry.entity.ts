import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum GradeEntryType {
  EXAM = 'exam',         // auto-created when a student submits an exam on the platform
  ASSIGNMENT = 'assignment',
  QUIZ = 'quiz',
  PROJECT = 'project',
  OTHER = 'other',
}

@Entity('grade_entries')
@Index(['classOfferingId', 'studentId', 'title'])
export class GradeEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The class this grade belongs to */
  @Column({ name: 'class_offering_id', type: 'uuid' })
  classOfferingId: string;

  /** The student this grade is for */
  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  /** Teacher who owns/created this grade entry */
  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  /** e.g. "Assignment 1", "Quiz 3", "Midterm Exam" */
  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'simple-enum', enum: GradeEntryType, default: GradeEntryType.OTHER })
  type: GradeEntryType;

  /** Score the student received */
  @Column({ type: 'float', nullable: true })
  score: number | null;

  /** Maximum possible score for this entry */
  @Column({ name: 'max_score', type: 'float', default: 100 })
  maxScore: number;

  /** Optional note from teacher */
  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** If this was auto-created from a platform exam attempt, store the attemptId */
  @Column({ name: 'exam_attempt_id', type: 'uuid', nullable: true })
  examAttemptId: string | null;

  /** Optional term this grade entry belongs to */
  @Column({ name: 'term_id', type: 'uuid', nullable: true })
  termId: string | null;

  /** Whether the result has been released/visible to the student */
  @Column({ name: 'released_at', type: 'timestamp', nullable: true })
  releasedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
