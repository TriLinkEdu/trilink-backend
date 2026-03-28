import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('badges')
export class Badge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  key: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'icon_key', type: 'varchar', length: 64, nullable: true })
  iconKey: string | null;

  @Column({ name: 'points_value', type: 'int', default: 0 })
  pointsValue: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
