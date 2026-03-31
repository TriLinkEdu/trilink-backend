import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, Index } from 'typeorm';

@Entity('user_settings')
@Index(['userId'], { unique: true })
export class UserSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'settings_json', type: 'text', default: '{}' })
  settingsJson: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
