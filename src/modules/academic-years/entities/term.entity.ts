import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AcademicYear } from './academic-year.entity';

@Entity('terms')
export class Term {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'academic_year_id', type: 'uuid' })
  academicYearId: string;

  @ManyToOne(() => AcademicYear, (y) => y.terms, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'academic_year_id' })
  academicYear: AcademicYear;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ name: 'start_date', type: 'varchar', length: 10 })
  startDate: string;

  @Column({ name: 'end_date', type: 'varchar', length: 10 })
  endDate: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
