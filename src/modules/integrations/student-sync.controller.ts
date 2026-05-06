import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Notification } from '../notifications/entities/notification.entity';
import { GradeEntry } from '../grades/entities/grade-entry.entity';
import { AttendanceMark } from '../attendance/entities/attendance-mark.entity';
import { ExamAttempt } from '../exams/entities/exam-attempt.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';

type SyncStatus = 'synced' | 'pending' | 'error';

interface SyncItemDto {
  id: string;
  category: string;
  description: string;
  status: SyncStatus;
  lastSyncedAt: string;
  pendingCount: number;
  totalCount: number;
}

@ApiTags('Integrations')
@Controller('sync/student')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT)
@ApiBearerAuth('JWT')
export class StudentSyncController {
  constructor(
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
    @InjectRepository(GradeEntry) private readonly grades: Repository<GradeEntry>,
    @InjectRepository(AttendanceMark) private readonly attendance: Repository<AttendanceMark>,
    @InjectRepository(ExamAttempt) private readonly attempts: Repository<ExamAttempt>,
    @InjectRepository(ParentStudent) private readonly parentStudents: Repository<ParentStudent>,
  ) {}

  @Get('status')
  @ApiOperation({
    summary: 'Student sync status overview',
    description: 'Lightweight status endpoint for mobile sync dashboard.',
  })
  async status(@CurrentUser() user: User) {
    return this.buildStatus(user);
  }

  @Post('trigger')
  @ApiOperation({
    summary: 'Trigger student sync',
    description: 'Acknowledges sync action and returns refreshed status.',
  })
  async trigger(@CurrentUser() user: User) {
    const status = await this.buildStatus(user);
    return {
      ...status,
      triggeredAt: new Date().toISOString(),
      accepted: true,
    };
  }

  private async studentIdsFor(user: User): Promise<string[]> {
    if (user.role === UserRole.STUDENT) return [user.id];
    if (user.role === UserRole.PARENT) {
      const links = await this.parentStudents.find({ where: { parentId: user.id } });
      return links.map((l) => l.studentId);
    }
    return [];
  }

  private latestIso(date?: Date | null): string {
    return (date ?? new Date()).toISOString();
  }

  private async buildStatus(user: User) {
    const now = new Date().toISOString();
    const studentIds = await this.studentIdsFor(user);
    const studentWhere = studentIds.length ? { studentId: In(studentIds) } : null;

    const [notificationTotal, notificationPending, latestNotification] = await Promise.all([
      this.notifications.count({ where: { userId: user.id } }),
      this.notifications.count({ where: { userId: user.id, readAt: IsNull() } }),
      this.notifications.findOne({ where: { userId: user.id }, order: { createdAt: 'DESC' } }),
    ]);

    const [gradeTotal, latestGrade] = studentWhere
      ? await Promise.all([
          this.grades.count({ where: { ...studentWhere, releasedAt: Not(IsNull()) } }),
          this.grades.findOne({ where: { ...studentWhere, releasedAt: Not(IsNull()) }, order: { updatedAt: 'DESC' } }),
        ])
      : [0, null] as const;

    const [attendanceTotal, latestAttendance] = studentWhere
      ? await Promise.all([
          this.attendance.count({ where: studentWhere }),
          this.attendance.findOne({ where: studentWhere, order: { createdAt: 'DESC' } }),
        ])
      : [0, null] as const;

    const [attemptTotal, pendingResults, latestAttempt] = studentWhere
      ? await Promise.all([
          this.attempts.count({ where: studentWhere }),
          this.attempts.count({ where: { ...studentWhere, submittedAt: Not(IsNull()), releasedAt: IsNull() } }),
          this.attempts.findOne({ where: studentWhere, order: { updatedAt: 'DESC' } }),
        ])
      : [0, 0, null] as const;

    const items: SyncItemDto[] = [
      {
        id: 'sync-api',
        category: 'API Link',
        description: 'Authentication and transport status',
        status: 'synced',
        lastSyncedAt: now,
        pendingCount: 0,
        totalCount: 1,
      },
      {
        id: 'sync-notifications',
        category: 'Notifications',
        description: 'Unread and historical notifications for this account',
        status: notificationPending > 0 ? 'pending' : 'synced',
        lastSyncedAt: this.latestIso(latestNotification?.createdAt),
        pendingCount: notificationPending,
        totalCount: notificationTotal,
      },
      {
        id: 'sync-grades',
        category: 'Grades',
        description: 'Released grade entries for the current student scope',
        status: 'synced',
        lastSyncedAt: this.latestIso(latestGrade?.updatedAt),
        pendingCount: 0,
        totalCount: gradeTotal,
      },
      {
        id: 'sync-attendance',
        category: 'Attendance',
        description: 'Attendance marks for the current student scope',
        status: 'synced',
        lastSyncedAt: this.latestIso(latestAttendance?.createdAt),
        pendingCount: 0,
        totalCount: attendanceTotal,
      },
      {
        id: 'sync-exams',
        category: 'Exams',
        description: 'Exam attempts and result release state',
        status: pendingResults > 0 ? 'pending' : 'synced',
        lastSyncedAt: this.latestIso(latestAttempt?.updatedAt),
        pendingCount: pendingResults,
        totalCount: attemptTotal,
      },
    ];

    return {
      generatedAt: now,
      userId: user.id,
      role: user.role,
      studentIds,
      items,
    };
  }
}
