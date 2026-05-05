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
import { Section } from './section.entity';

@Entity('grade_sections')
@Index(['gradeId', 'sectionId'], { unique: true })
export class GradeSectionAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'grade_id', type: 'uuid' })
  gradeId: string;

  @ManyToOne(() => Grade, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'grade_id' })
  grade: Grade;

  @Column({ name: 'section_id', type: 'uuid' })
  sectionId: string;

  @ManyToOne(() => Section, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id' })
  section: Section;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
