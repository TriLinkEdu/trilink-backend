import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feedback } from '../feedback/entities/feedback.entity';
import { Exam } from '../exams/entities/exam.entity';
import { ExamAttempt } from '../exams/entities/exam-attempt.entity';
import { AttendanceMark } from '../attendance/entities/attendance-mark.entity';
import { Announcement } from '../announcements/entities/announcement.entity';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Feedback) private readonly fbRepo: Repository<Feedback>,
    @InjectRepository(Exam) private readonly examRepo: Repository<Exam>,
    @InjectRepository(ExamAttempt) private readonly attRepo: Repository<ExamAttempt>,
    @InjectRepository(AttendanceMark) private readonly markRepo: Repository<AttendanceMark>,
    @InjectRepository(Announcement) private readonly annRepo: Repository<Announcement>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async adminSummary() {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const feedbackByStatus = await this.fbRepo
      .createQueryBuilder('f')
      .select('f.status', 'status')
      .addSelect('COUNT(*)', 'cnt')
      .groupBy('f.status')
      .getRawMany();

    const examsPublished = await this.examRepo.count({ where: { published: true } });
    const attemptsSubmitted = await this.attRepo
      .createQueryBuilder('a')
      .where('a.submitted_at IS NOT NULL')
      .getCount();

    const attemptsReleased = await this.attRepo
      .createQueryBuilder('a')
      .where('a.released_at IS NOT NULL')
      .getCount();

    const marksLast30 = await this.markRepo
      .createQueryBuilder('m')
      .where('m.created_at >= :s', { s: since })
      .getCount();

    const presentLast30 = await this.markRepo
      .createQueryBuilder('m')
      .where('m.created_at >= :s', { s: since })
      .andWhere("m.status IN ('present','late')")
      .getCount();

    const announcements = await this.annRepo.count();

    const [admin, teacher, student, parent] = await Promise.all([
      this.userRepo.count({ where: { role: UserRole.ADMIN } }),
      this.userRepo.count({ where: { role: UserRole.TEACHER } }),
      this.userRepo.count({ where: { role: UserRole.STUDENT } }),
      this.userRepo.count({ where: { role: UserRole.PARENT } }),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      users: { admin, teacher, student, parent, total: admin + teacher + student + parent },
      feedbackTicketsByStatus: feedbackByStatus.map((r) => ({
        status: r.status,
        count: parseInt(r.cnt, 10),
      })),
      exams: { publishedCount: examsPublished },
      examAttempts: { submitted: attemptsSubmitted, released: attemptsReleased },
      attendance: {
        marksRecordedLast30Days: marksLast30,
        presentOrLateLast30Days: presentLast30,
        presentRateLast30DaysApprox:
          marksLast30 > 0 ? Math.round((presentLast30 / marksLast30) * 1000) / 1000 : null,
      },
      announcementsTotal: announcements,
    };
  }
}
