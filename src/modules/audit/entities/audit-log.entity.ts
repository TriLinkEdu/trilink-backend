import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @Column({ type: 'varchar', length: 120 })
  action: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 120 })
  entityType: string;

  @Column({ name: 'entity_id', type: 'varchar', length: 64 })
  entityId: string;

  @Column({ name: 'diff_json', type: 'text', nullable: true })
  diffJson: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
