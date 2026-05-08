/**
 * Gamification domain event constants and payload types.
 *
 * All cross-service communication flows through these typed events.
 * Services EMIT events; listeners handle side effects asynchronously.
 */

export const GAMIFICATION_EVENTS = {
  XP_EARNED              : 'gamification.xp_earned',
  ACHIEVEMENTS_UNLOCKED  : 'gamification.achievements_unlocked',
  STREAK_UPDATED         : 'gamification.streak_updated',
  QUIZ_COMPLETED         : 'gamification.quiz_completed',
  MISSION_COMPLETED      : 'gamification.mission_completed',
  LEADERBOARD_CHANGED    : 'gamification.leaderboard_changed',
} as const;

export interface XpEarnedEvent {
  userId     : string;
  amount     : number;
  source     : 'quiz' | 'mission' | 'badge_award' | 'attendance' | 'exam';
  sourceId  ?: string;
}

export interface QuizCompletedEvent {
  userId         : string;
  quizId         : string;
  subjectId      : string;
  score          : number;
  correctAnswers : number;
  totalQuestions : number;
  xpEarned       : number;
}

export interface MissionCompletedEvent {
  userId    : string;
  missionId : string;
  xpEarned  : number;
}

export interface StreakUpdatedEvent {
  userId         : string;
  currentStreak  : number;
  longestStreak  : number;
}

export interface AchievementsUnlockedEvent {
  userId         : string;
  achievementIds : string[];
}
