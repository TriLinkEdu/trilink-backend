import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('parent_students')
@Index(['parentId', 'studentId'], { unique: true })
export class ParentStudent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'parent_id', type: 'uuid' })
  parentId: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @Column({ type: 'varchar', length: 40 })
  relationship: string;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
