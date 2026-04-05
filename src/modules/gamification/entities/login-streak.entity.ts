import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, Index } from 'typeorm';

@Entity('login_streaks')
export class LoginStreak {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'current_streak', type: 'int', default: 0 })
  currentStreak: number;

  @Column({ name: 'longest_streak', type: 'int', default: 0 })
  longestStreak: number;

  /** UTC date YYYY-MM-DD of last counted login. */
  @Column({ name: 'last_login_date', type: 'date', nullable: true })
  lastLoginDate: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
