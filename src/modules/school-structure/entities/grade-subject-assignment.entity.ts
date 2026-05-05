import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Grade } from './grade.entity';
import { Subject } from './subject.entity';

@Entity('grade_subjects')
@Index(['gradeId', 'subjectId'], { unique: true })
export class GradeSubjectAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'grade_id', type: 'uuid' })
  gradeId: string;

  @ManyToOne(() => Grade, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'grade_id' })
  grade: Grade;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @ManyToOne(() => Subject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id' })
  subject: Subject;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
