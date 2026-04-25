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

  @Column({ name: 'storage_provider', type: 'varchar', length: 32, default: 'cloudinary' })
  storageProvider: string;

  @Column({ name: 'storage_key', type: 'varchar', length: 500, nullable: true })
  storageKey: string | null;

  @Column({ name: 'version', type: 'varchar', length: 120, nullable: true })
  version: string | null;

  @Column({ name: 'etag', type: 'varchar', length: 255, nullable: true })
  etag: string | null;

  @Column({ name: 'size_bytes', type: 'bigint', nullable: true })
  sizeBytes: string | null;

  @Column({ name: 'uploaded_by_id', type: 'uuid' })
  uploadedById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
