import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('exams')
export class Exam {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ name: 'academic_year_id', type: 'uuid' })
  academicYearId: string;

  @Column({ name: 'class_offering_id', type: 'uuid', nullable: true })
  classOfferingId: string | null;

  @Column({ name: 'opens_at', type: 'datetime' })
  opensAt: Date;

  @Column({ name: 'closes_at', type: 'datetime' })
  closesAt: Date;

  @Column({ name: 'duration_minutes', type: 'int' })
  durationMinutes: number;

  /** Scale for final score (e.g. 100). Auto and manual grades are clamped to this. */
  @Column({ name: 'max_points', type: 'int', default: 100 })
  maxPoints: number;

  @Column({ type: 'boolean', default: false })
  published: boolean;

  @Column({ name: 'created_by_id', type: 'uuid' })
  createdById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
