import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('attendance_sessions')
@Index(['classOfferingId', 'date'], { unique: true })
export class AttendanceSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'class_offering_id', type: 'uuid' })
  classOfferingId: string;

  @Column({ type: 'varchar', length: 10 })
  date: string;

  @Column({ name: 'taken_by_id', type: 'uuid' })
  takenById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
