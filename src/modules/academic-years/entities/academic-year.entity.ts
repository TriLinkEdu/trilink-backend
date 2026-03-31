import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Term } from './term.entity';

@Entity('academic_years')
export class AcademicYear {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32 })
  label: string;

  @Column({ name: 'start_date', type: 'varchar', length: 10 })
  startDate: string;

  @Column({ name: 'end_date', type: 'varchar', length: 10 })
  endDate: string;

  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive: boolean;

  @Column({ name: 'is_archived', type: 'boolean', default: false })
  isArchived: boolean;

  @OneToMany(() => Term, (t) => t.academicYear)
  terms: Term[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
