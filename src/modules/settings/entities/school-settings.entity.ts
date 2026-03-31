import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('school_settings')
export class SchoolSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'settings_json', type: 'text', default: '{}' })
  settingsJson: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
