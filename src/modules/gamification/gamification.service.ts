import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Badge } from './entities/badge.entity';
import { UserBadge } from './entities/user-badge.entity';
import { ExamAttempt } from '../exams/entities/exam-attempt.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';

@Injectable()
export class GamificationService implements OnModuleInit {
  constructor(
    @InjectRepository(Badge) private readonly badgeRepo: Repository<Badge>,
    @InjectRepository(UserBadge) private readonly ubRepo: Repository<UserBadge>,
    @InjectRepository(ExamAttempt) private readonly attRepo: Repository<ExamAttempt>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(ParentStudent) private readonly psRepo: Repository<ParentStudent>,
  ) {}

  async assertStudentViewer(viewer: User, studentId: string) {
    if (viewer.role === UserRole.ADMIN || viewer.role === UserRole.TEACHER) return;
    if (viewer.role === UserRole.STUDENT && viewer.id === studentId) return;
    if (viewer.role === UserRole.PARENT) {
      const link = await this.psRepo.findOne({ where: { parentId: viewer.id, studentId } });
      if (link) return;
    }
    throw new ForbiddenException('Cannot access this student');
  }

  async onModuleInit() {
    const n = await this.badgeRepo.count();
    if (n > 0) return;
    await this.badgeRepo.save([
      this.badgeRepo.create({
        key: 'first_steps',
        name: 'First steps',
        description: 'Welcome — keep learning.',
        iconKey: 'star',
        pointsValue: 5,
      }),
      this.badgeRepo.create({
        key: 'exam_hero',
        name: 'Exam hero',
        description: 'Strong exam performance streak.',
        iconKey: 'trophy',
        pointsValue: 25,
      }),
      this.badgeRepo.create({
        key: 'perfect_attendance_week',
        name: 'Attendance star',
        description: 'Present every session in a week.',
        iconKey: 'calendar',
        pointsValue: 15,
      }),
    ]);
  }

  listBadges() {
    return this.badgeRepo.find({ order: { name: 'ASC' } });
  }

  async createBadge(body: { key: string; name: string; description?: string; iconKey?: string; pointsValue?: number }) {
    const existing = await this.badgeRepo.findOne({ where: { key: body.key } });
    if (existing) throw new ConflictException('Badge key exists');
    return this.badgeRepo.save(
      this.badgeRepo.create({
        key: body.key,
        name: body.name,
        description: body.description ?? null,
        iconKey: body.iconKey ?? null,
        pointsValue: body.pointsValue ?? 0,
      }),
    );
  }

  async awardBadge(userId: string, badgeId: string, awardedById: string | null) {
    const badge = await this.badgeRepo.findOne({ where: { id: badgeId } });
    if (!badge) throw new NotFoundException('Badge not found');
    const dup = await this.ubRepo.findOne({ where: { userId, badgeId } });
    if (dup) throw new ConflictException('User already has this badge');
    return this.ubRepo.save(this.ubRepo.create({ userId, badgeId, awardedById }));
  }

  async listUserBadges(userId: string) {
    const rows = await this.ubRepo.find({ where: { userId }, order: { awardedAt: 'DESC' } });
    const out = [];
    for (const r of rows) {
      const b = await this.badgeRepo.findOne({ where: { id: r.badgeId } });
      out.push({ ...r, badge: b });
    }
    return out;
  }

  async leaderboardByExamAverage(academicYearId: string, limit = 20) {
    const qb = this.attRepo
      .createQueryBuilder('a')
      .innerJoin('exams', 'e', 'e.id = a.exam_id')
      .select('a.student_id', 'studentId')
      .addSelect('AVG(a.score)', 'avgScore')
      .addSelect('COUNT(*)', 'examCount')
      .where('e.academic_year_id = :yid', { yid: academicYearId })
      .andWhere('a.released_at IS NOT NULL')
      .andWhere('a.score IS NOT NULL')
      .groupBy('a.student_id')
      .orderBy('avgScore', 'DESC')
      .take(Math.min(Math.max(limit, 1), 100));

    const raw = await qb.getRawMany();
    const ranked = [];
    let rank = 1;
    for (const row of raw) {
      const u = await this.userRepo.findOne({ where: { id: row.studentId } });
      ranked.push({
        rank: rank++,
        studentId: row.studentId,
        averageScore: Math.round(parseFloat(row.avgScore) * 100) / 100,
        examsCounted: parseInt(row.examCount, 10),
        student: u
          ? { firstName: u.firstName, lastName: u.lastName, email: u.email, grade: u.grade, section: u.section }
          : null,
      });
    }
    return { academicYearId, metric: 'averageReleasedExamScore', entries: ranked };
  }

  async totalBadgePoints(userId: string) {
    const rows = await this.ubRepo.find({ where: { userId } });
    let total = 0;
    for (const r of rows) {
      const b = await this.badgeRepo.findOne({ where: { id: r.badgeId } });
      if (b) total += b.pointsValue;
    }
    return { userId, totalBadgePoints: total, badgeCount: rows.length };
  }

  async listUserBadgesForViewer(studentId: string, viewer: User) {
    await this.assertStudentViewer(viewer, studentId);
    return this.listUserBadges(studentId);
  }

  async totalBadgePointsForViewer(studentId: string, viewer: User) {
    await this.assertStudentViewer(viewer, studentId);
    return this.totalBadgePoints(studentId);
  }
}
