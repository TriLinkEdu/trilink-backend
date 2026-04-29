import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  type: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ name: 'class_offering_id', type: 'uuid', nullable: true })
  classOfferingId: string | null;

  @Column({ name: 'parent_visible', type: 'boolean', default: true })
  parentVisible: boolean;

  @Column({ name: 'created_by_id', type: 'uuid' })
  createdById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
