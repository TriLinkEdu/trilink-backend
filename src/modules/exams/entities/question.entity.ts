import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Subject } from '../../school-structure/entities/subject.entity';

@Entity('questions')
export class Question {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  type: string;

  @Column({ type: 'text' })
  stem: string;

  @Column({ name: 'options_json', type: 'text', nullable: true })
  optionsJson: string | null;

  @Column({ name: 'answer_key', type: 'text', nullable: true })
  answerKey: string | null;

  /** JSON array of { fileId?, url?, kind?: \"image\" } for LaTeX use plain text in stem + delimiters client-side */
  @Column({ name: 'attachments_json', type: 'text', nullable: true })
  attachmentsJson: string | null;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  /**
   * Optional AI-engine curriculum topic ID (a loosely-coupled reference to the
   * `topics` table in the Python AI engine's database).  When set, BKT mastery
   * updates will target this specific topic instead of falling back to the broad
   * subjectId, giving the Learning Path and Recommendation services accurate data.
   */
  @Column({ name: 'topic_id', type: 'varchar', nullable: true, default: null })
  topicId: string | null;

  @ManyToOne(() => Subject)
  @JoinColumn({ name: 'subject_id' })
  subject?: Subject;

  @Column({ name: 'created_by_id', type: 'uuid' })
  createdById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
