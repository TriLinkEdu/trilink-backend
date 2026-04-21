import { User } from '../modules/users/entities/user.entity';
import { AcademicYear } from '../modules/academic-years/entities/academic-year.entity';
import { Term } from '../modules/academic-years/entities/term.entity';
import { Grade } from '../modules/school-structure/entities/grade.entity';
import { Section } from '../modules/school-structure/entities/section.entity';
import { Subject } from '../modules/school-structure/entities/subject.entity';
import { ClassOffering } from '../modules/class-offerings/entities/class-offering.entity';
import { Enrollment } from '../modules/enrollments/entities/enrollment.entity';
import { ParentStudent } from '../modules/parent-students/entities/parent-student.entity';
import { CalendarEvent } from '../modules/calendar/entities/calendar-event.entity';
import { AttendanceSession } from '../modules/attendance/entities/attendance-session.entity';
import { AttendanceMark } from '../modules/attendance/entities/attendance-mark.entity';
import { Question } from '../modules/exams/entities/question.entity';
import { Exam } from '../modules/exams/entities/exam.entity';
import { ExamQuestion } from '../modules/exams/entities/exam-question.entity';
import { ExamAttempt } from '../modules/exams/entities/exam-attempt.entity';
import { Announcement } from '../modules/announcements/entities/announcement.entity';
import { Feedback } from '../modules/feedback/entities/feedback.entity';
import { Notification } from '../modules/notifications/entities/notification.entity';
import { Conversation } from '../modules/chat/entities/conversation.entity';
import { ConversationMember } from '../modules/chat/entities/conversation-member.entity';
import { ChatMessage } from '../modules/chat/entities/chat-message.entity';
import { UserSettings } from '../modules/settings/entities/user-settings.entity';
import { SchoolSettings } from '../modules/settings/entities/school-settings.entity';
import { FileRecord } from '../modules/files/entities/file-record.entity';
import { AuditLog } from '../modules/audit/entities/audit-log.entity';
import { Badge } from '../modules/gamification/entities/badge.entity';
import { UserBadge } from '../modules/gamification/entities/user-badge.entity';
import { LoginStreak } from '../modules/gamification/entities/login-streak.entity';
import { StudentGoal } from '../modules/goals/entities/student-goal.entity';
import { Assignment } from '../modules/assignments/entities/assignment.entity';
import { AssignmentSubmission } from '../modules/assignments/entities/assignment-submission.entity';
import { StudentProfile } from '../modules/student-profiles/entities/student-profile.entity';

export const TYPEORM_ENTITIES = [
  User,
  AcademicYear,
  Term,
  Grade,
  Section,
  Subject,
  ClassOffering,
  Enrollment,
  ParentStudent,
  CalendarEvent,
  AttendanceSession,
  AttendanceMark,
  Question,
  Exam,
  ExamQuestion,
  ExamAttempt,
  Announcement,
  Feedback,
  Notification,
  Conversation,
  ConversationMember,
  ChatMessage,
  UserSettings,
  SchoolSettings,
  FileRecord,
  AuditLog,
  Badge,
  UserBadge,
  LoginStreak,
  StudentGoal,
  Assignment,
  AssignmentSubmission,
  StudentProfile,
];
