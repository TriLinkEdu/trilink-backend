import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Announcement } from './entities/announcement.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { EventsGateway } from '../realtime/events.gateway';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { Grade } from '../school-structure/entities/grade.entity';
import { Section } from '../school-structure/entities/section.entity';
import { Subject } from '../school-structure/entities/subject.entity';

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectRepository(Announcement) private readonly repo: Repository<Announcement>,
    @InjectRepository(Enrollment) private readonly enrRepo: Repository<Enrollment>,
    @InjectRepository(ParentStudent) private readonly psRepo: Repository<ParentStudent>,
    private readonly events: EventsGateway,
    private readonly notifications: NotificationsService,
  ) {}

  private shouldEmitNow(publishAt: Date | null): boolean {
    if (!publishAt) return true;
    return publishAt.getTime() <= Date.now();
  }

  private normalizeAudiences(audience: string): string[] {
    return [...new Set(
      (audience || '')
        .split(',')
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean),
    )];
  }

  private matchesScope(a: Announcement, opts: { termId?: string; grade?: string | null; section?: string | null; classOfferingIds?: string[] } = {}) {
    const audiences = this.normalizeAudiences(a.audience);
    const hasAudience = (name: string) => audiences.includes(name) || audiences.includes('all');
    const termMatches = !opts.termId || !a.termId || a.termId === opts.termId;
    const gradeMatches = !a.targetGrade || !opts.grade || a.targetGrade === opts.grade;
    const sectionMatches = !a.targetSection || !opts.section || a.targetSection === opts.section;
    const classMatches = !a.classOfferingId || !opts.classOfferingIds?.length || opts.classOfferingIds.includes(a.classOfferingId);

    return { audiences, hasAudience, termMatches, gradeMatches, sectionMatches, classMatches };
  }

  async create(
    body: Partial<Announcement> & Pick<Announcement, 'academicYearId' | 'title' | 'body' | 'audience' | 'authorId'>,
  ) {
    const publishAt = body.publishAt ?? null;
    const a = await this.repo.save(
      this.repo.create({
        ...body,
        targetSection: body.targetSection ?? null,
        termId: body.termId ?? null,
        publishAt,
        realtimeSent: false,
      }),
    );
    if (this.shouldEmitNow(publishAt)) {
      this.events.emitToAll('announcement:new', { id: a.id, audience: a.audience, classOfferingId: a.classOfferingId, targetGrade: a.targetGrade, targetSection: a.targetSection, termId: a.termId, title: a.title, body: a.body });
      await this.notifyTargets(a);
      a.realtimeSent = true;
      await this.repo.save(a);
    }
    return a;
  }

  private async notifyTargets(a: Announcement) {
    const userRepo = this.repo.manager.getRepository(User);
    const targetUserIds: string[] = [];
    const audiences = this.normalizeAudiences(a.audience);

    const addUsers = (users: User[]) => targetUserIds.push(...users.map((u) => u.id));

    const addParentsOfStudentIds = async (studentIds: string[]) => {
      if (!studentIds.length) return;
      const links = await this.psRepo.createQueryBuilder('ps').where('ps.studentId IN (:...ids)', { ids: studentIds }).getMany();
      targetUserIds.push(...links.map((l) => l.parentId));
    };

    if (audiences.includes('all')) {
      // Notify all students and parents
      addUsers(await userRepo.find({ where: { role: UserRole.STUDENT } }));
      addUsers(await userRepo.find({ where: { role: UserRole.PARENT } }));
    }

    if (audiences.includes('students')) {
      const qb = userRepo.createQueryBuilder('u').where('u.role = :role', { role: UserRole.STUDENT });
      if (a.targetGrade) qb.andWhere('u.grade = :grade', { grade: a.targetGrade });
      if (a.targetSection) qb.andWhere('u.section = :section', { section: a.targetSection });
      addUsers(await qb.getMany());
    }

    if (audiences.includes('parents')) {
      const qb = userRepo.createQueryBuilder('u').where('u.role = :role', { role: UserRole.STUDENT });
      if (a.targetGrade) qb.andWhere('u.grade = :grade', { grade: a.targetGrade });
      if (a.targetSection) qb.andWhere('u.section = :section', { section: a.targetSection });
      const students = await qb.getMany();
      await addParentsOfStudentIds(students.map((s) => s.id));
    }

    if (audiences.includes('teachers')) {
      addUsers(await userRepo.find({ where: { role: UserRole.TEACHER } }));
    }

    if (audiences.includes('class') && a.classOfferingId) {
      const enrs = await this.enrRepo.find({ where: { classOfferingId: a.classOfferingId, status: 'active' } });
      const studentIds = enrs.map(e => e.studentId);
      targetUserIds.push(...studentIds);
      await addParentsOfStudentIds(studentIds);
    }

    if (audiences.includes('grade') && a.targetGrade) {
      const qb = userRepo.createQueryBuilder('u').where('u.role = :role', { role: UserRole.STUDENT });
      qb.andWhere('u.grade = :grade', { grade: a.targetGrade });
      if (a.targetSection) qb.andWhere('u.section = :section', { section: a.targetSection });
      const students = await qb.getMany();
      targetUserIds.push(...students.map((s) => s.id));
      await addParentsOfStudentIds(students.map((s) => s.id));
    }

    const uniqueIds = [...new Set(targetUserIds)];
    for (const uid of uniqueIds) {
      await this.notifications.createForUser(uid, {
        type: 'announcement',
        title: a.title,
        body: a.body.substring(0, 100),
        payloadJson: JSON.stringify({ announcementId: a.id }),
      });
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async flushScheduledAnnouncements() {
    const now = new Date();
    const due = await this.repo
      .createQueryBuilder('a')
      .where('a.realtime_sent = :rs', { rs: false })
      .andWhere('a.publish_at IS NOT NULL')
      .andWhere('a.publish_at <= :now', { now })
      .getMany();
    for (const a of due) {
      if (!a.publishAt) continue;
      this.events.emitToAll('announcement:new', { id: a.id, audience: a.audience, classOfferingId: a.classOfferingId, targetGrade: a.targetGrade, title: a.title, body: a.body });
      await this.notifyTargets(a);
      a.realtimeSent = true;
      await this.repo.save(a);
    }
  }

  list(yearId?: string, termId?: string) {
    const qb = this.repo.createQueryBuilder('a').orderBy('a.created_at', 'DESC');
    if (yearId) qb.where('a.academic_year_id = :y', { y: yearId });
    if (termId) qb.andWhere('(a.term_id IS NULL OR a.term_id = :termId)', { termId });
    return qb.getMany();
  }

  private isVisibleToAudience(a: Announcement, now: Date): boolean {
    if (!a.publishAt) return true;
    return a.publishAt.getTime() <= now.getTime();
  }

  async forUser(user: User, termId?: string) {
    const now = new Date();
    const all = await this.repo.find({ order: { createdAt: 'DESC' } });
    let visible = all.filter((a) => this.isVisibleToAudience(a, now));
    if (termId) visible = visible.filter((a) => !a.termId || a.termId === termId);
    if (user.role === UserRole.ADMIN || user.role === UserRole.TEACHER) return visible;
    if (user.role === UserRole.STUDENT) {
      const enr = await this.enrRepo.find({ where: { studentId: user.id, status: 'active' } });
      const classIds = enr.map((e) => e.classOfferingId);
      return visible.filter(
        (a) => {
          const { audiences } = this.matchesScope(a, { grade: user.grade, section: user.section, classOfferingIds: classIds });
          const scopeOk = (!a.targetGrade || a.targetGrade === user.grade) && (!a.targetSection || a.targetSection === user.section);
          return (
            audiences.includes('all') ||
            (audiences.includes('students') && scopeOk) ||
            (audiences.includes('grade') && scopeOk) ||
            (audiences.includes('class') && a.classOfferingId && classIds.includes(a.classOfferingId))
          );
        },
      );
    }
    if (user.role === UserRole.PARENT) {
      const links = await this.psRepo.find({ where: { parentId: user.id } });
      const childIds = links.map(l => l.studentId);
      const enrs = await this.enrRepo.createQueryBuilder('e').where('e.studentId IN (:...ids)', { ids: childIds.length ? childIds : ['00000000-0000-0000-0000-000000000000'] }).getMany();
      const childClassIds = enrs.map(e => e.classOfferingId);
      const childGrades = await this.repo.manager.getRepository(User).createQueryBuilder('u').where('u.id IN (:...ids)', { ids: childIds.length ? childIds : ['00000000-0000-0000-0000-000000000000'] }).getMany();
      const gradeNames = childGrades.map(g => g.grade);
      
      return visible.filter((a) => {
        const { audiences } = this.matchesScope(a, { classOfferingIds: childClassIds });
        const scopeOk = childGrades.some((g) => (!a.targetGrade || a.targetGrade === g.grade) && (!a.targetSection || a.targetSection === g.section));
        return (
          audiences.includes('all') ||
          (audiences.includes('parents') && scopeOk) ||
          (audiences.includes('grade') && a.targetGrade && gradeNames.includes(a.targetGrade) && scopeOk) ||
          (audiences.includes('class') && a.classOfferingId && childClassIds.includes(a.classOfferingId))
        );
      }
      );
    }
    return [];
  }

  async update(
    id: string,
    body: Partial<Pick<Announcement, 'title' | 'body' | 'audience' | 'classOfferingId' | 'targetGrade' | 'targetSection' | 'termId' | 'publishAt'>>,
    viewer: User,
  ) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Not found');
    if (viewer.role !== UserRole.ADMIN && a.authorId !== viewer.id) {
      throw new ForbiddenException('Only the author or admin can edit');
    }
    for (const [key, val] of Object.entries(body)) {
      if (val !== undefined) (a as any)[key] = val;
    }
    const saved = await this.repo.save(a);
    if (!saved.publishAt && !saved.realtimeSent) {
      this.events.emitToAll('announcement:new', { id: saved.id, audience: saved.audience, classOfferingId: saved.classOfferingId, targetGrade: saved.targetGrade, targetSection: saved.targetSection, termId: saved.termId, title: saved.title, body: saved.body });
      await this.notifyTargets(saved);
      saved.realtimeSent = true;
      await this.repo.save(saved);
    }
    return saved;
  }

  async remove(id: string, viewer?: User) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Not found');
    if (viewer && viewer.role !== UserRole.ADMIN && a.authorId !== viewer.id) {
      throw new ForbiddenException('Only the author or admin can delete this announcement');
    }
    await this.repo.remove(a);
  }
}
