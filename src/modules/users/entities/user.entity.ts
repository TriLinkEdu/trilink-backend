import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  ADMIN = 'admin',
  TEACHER = 'teacher',
  STUDENT = 'student',
  PARENT = 'parent',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 20 })
  role: UserRole;

  @Column({ name: 'first_name', type: 'varchar', length: 120 })
  firstName: string;

  @Column({ name: 'last_name', type: 'varchar', length: 120 })
  lastName: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone: string | null;

  @Column({ name: 'profile_image_file_id', type: 'uuid', nullable: true })
  profileImageFileId: string | null;

  /** Student: grade (e.g. Grade 9); Teacher/Parent: null */
  @Column({ type: 'varchar', length: 40, nullable: true })
  grade: string | null;

  /** Student: section (e.g. A); Teacher/Parent: null */
  @Column({ type: 'varchar', length: 20, nullable: true })
  section: string | null;

  /** Teacher: subject; Student/Parent: null */
  @Column({ type: 'varchar', length: 120, nullable: true })
  subject: string | null;

  /** Teacher: department; Student/Parent: null */
  @Column({ type: 'varchar', length: 120, nullable: true })
  department: string | null;

  /** Teacher: homeroom class label; Student/Parent: null */
  @Column({ name: 'homeroom_class', type: 'varchar', length: 80, nullable: true })
  homeroomClass: string | null;

  /** Teacher: years/summary of experience; Student/Parent: null */
  @Column({ type: 'varchar', length: 120, nullable: true })
  experience: string | null;

  /** Teacher profile address: country */
  @Column({ type: 'varchar', length: 120, nullable: true })
  country: string | null;

  /** Teacher profile address: city/state */
  @Column({ name: 'city_state', type: 'varchar', length: 120, nullable: true })
  cityState: string | null;

  /** Teacher profile address: postal code */
  @Column({ name: 'postal_code', type: 'varchar', length: 40, nullable: true })
  postalCode: string | null;

  /** Teacher office room label */
  @Column({ name: 'office_room', type: 'varchar', length: 80, nullable: true })
  officeRoom: string | null;

  /** Parent: child full name; Student/Teacher: null */
  @Column({ name: 'child_name', type: 'varchar', length: 200, nullable: true })
  childName: string | null;

  /** Parent: Father/Mother/Guardian; Student/Teacher: null */
  @Column({ type: 'varchar', length: 40, nullable: true })
  relationship: string | null;

  /** Temporary password set by admin; user should change on first login */
  @Column({ name: 'must_change_password', type: 'boolean', default: true })
  mustChangePassword: boolean;

  /** Chat presence */
  @Column({ name: 'last_seen_at', type: 'timestamp', nullable: true })
  lastSeenAt: Date | null;

  @Column({ name: 'is_online', type: 'boolean', default: false })
  isOnline: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
