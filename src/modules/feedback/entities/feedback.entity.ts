import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('feedbacks')
export class Feedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @Column({ type: 'varchar', length: 80 })
  category: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 40, default: 'open' })
  status: string;

  @Column({ name: 'assignee_id', type: 'uuid', nullable: true })
  assigneeId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
