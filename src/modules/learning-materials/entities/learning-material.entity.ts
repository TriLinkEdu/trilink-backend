import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ClassOffering } from '../../class-offerings/entities/class-offering.entity';

export enum MaterialType {
  PDF = 'pdf',
  TXT = 'txt',
  LINK = 'link',
}

@Entity('learning_materials')
export class LearningMaterial {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'enum', enum: MaterialType })
  type: MaterialType;

  @Column({ type: 'varchar', length: 500 })
  url: string;

  @Column({ type: 'varchar', length: 100 })
  subject: string;

  @Column({ type: 'int' })
  grade: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'topic_id', type: 'uuid', nullable: true })
  topicId: string | null;

  @Column({ name: 'uploaded_by_id', type: 'uuid' })
  uploadedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploaded_by_id' })
  uploadedBy: User;

  @Column({ name: 'class_offering_id', type: 'uuid' })
  classOfferingId: string;

  @ManyToOne(() => ClassOffering)
  @JoinColumn({ name: 'class_offering_id' })
  classOffering: ClassOffering;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
