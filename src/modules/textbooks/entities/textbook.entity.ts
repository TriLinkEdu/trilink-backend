import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { FileRecord } from '../../files/entities/file-record.entity';

@Entity('textbooks')
export class Textbook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 100 })
  subject: string;

  @Column({ type: 'int' })
  grade: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'page_count', type: 'int', nullable: true })
  pageCount: number | null;

  @Column({ name: 'size_bytes', type: 'bigint', nullable: true })
  sizeBytes: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /* ── Relations ────────────────────────────────────────────── */

  @Column({ name: 'file_record_id', type: 'uuid' })
  fileRecordId: string;

  @ManyToOne(() => FileRecord, { eager: true })
  @JoinColumn({ name: 'file_record_id' })
  fileRecord: FileRecord;

  @Column({ name: 'cover_image_file_id', type: 'uuid', nullable: true })
  coverImageFileId: string | null;

  @ManyToOne(() => FileRecord, { eager: true, nullable: true })
  @JoinColumn({ name: 'cover_image_file_id' })
  coverImageFile: FileRecord | null;

  /* ── Timestamps ───────────────────────────────────────────── */

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
