import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('exam_questions')
@Index(['examId', 'orderIndex'], { unique: true })
export class ExamQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'exam_id', type: 'uuid' })
  examId: string;

  @Column({ name: 'question_id', type: 'uuid' })
  questionId: string;

  @Column({ name: 'order_index', type: 'int' })
  orderIndex: number;

  @Column({ type: 'int', default: 1 })
  points: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
