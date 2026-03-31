import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('file_records')
export class FileRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  filename: string;

  @Column({ type: 'varchar', length: 120 })
  mime: string;

  @Column({ type: 'varchar', length: 500 })
  path: string;

  @Column({ name: 'uploaded_by_id', type: 'uuid' })
  uploadedById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
