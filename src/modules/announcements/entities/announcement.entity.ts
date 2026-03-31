import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('announcements')
export class Announcement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'academic_year_id', type: 'uuid' })
  academicYearId: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', length: 40 })
  audience: string;

  @Column({ name: 'class_offering_id', type: 'uuid', nullable: true })
  classOfferingId: string | null;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
