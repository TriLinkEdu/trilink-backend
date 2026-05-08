import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Materialized XP & level state per user.
 *
 * This is the single source of truth for a student's XP total and derived level.
 * It is updated atomically (with a SQL expression) every time XP is earned,
 * eliminating all dynamic SUM() queries over the user_badges audit log.
 *
 * Reads: O(1) — a single PK lookup.
 * Writes: one UPDATE per XP event, inside the same transaction.
 */
@Entity('gamification_profiles')
export class GamificationProfile {
  /** Same UUID as users.id — no auto-generated PK needed. */
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index()
  @Column({ name: 'total_xp', type: 'int', default: 0 })
  totalXp: number;

  /** Derived from totalXp at write time so reads never compute it. */
  @Index()
  @Column({ type: 'int', default: 1 })
  level: number;

  /**
   * Grade string copied from users.grade at profile creation ("Grade 9", etc.).
   * Indexed so leaderboard queries can filter without joining users.
   */
  @Index()
  @Column({ type: 'varchar', length: 40, nullable: true })
  grade: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  section: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
