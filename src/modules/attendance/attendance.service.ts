import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceSession } from './entities/attendance-session.entity';
import { AttendanceMark } from './entities/attendance-mark.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { GamificationService } from '../gamification/gamification.service';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceSession) private readonly sessRepo: Repository<AttendanceSession>,
    @InjectRepository(AttendanceMark) private readonly markRepo: Repository<AttendanceMark>,
    @InjectRepository(Enrollment) private readonly enrRepo: Repository<Enrollment>,
    @InjectRepository(ParentStudent) private readonly psRepo: Repository<ParentStudent>,
    private readonly notifications: NotificationsService,
    private readonly gamification: GamificationService,
  ) {}

  async createSession(body: { classOfferingId: string; date: string; takenById: string }) {
    const dup = await this.sessRepo.findOne({ where: { classOfferingId: body.classOfferingId, date: body.date } });
    if (dup) throw new ConflictException('Session already exists for this date');
    return this.sessRepo.save(this.sessRepo.create(body));
  }

  async listSessions(classOfferingId: string) {
    return this.sessRepo.find({ where: { classOfferingId }, order: { date: 'DESC' } });
  }

  async putMarks(sessionId: string, marks: { studentId: string; status: string; note?: string }[]) {
    const session = await this.sessRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    const enrolled = await this.enrRepo.find({ where: { classOfferingId: session.classOfferingId, status: 'active' } });
    const ids = new Set(enrolled.map((e) => e.studentId));
    for (const m of marks) {
      if (!ids.has(m.studentId)) throw new BadRequestException(`Student ${m.studentId} not in class`);
      const existing = await this.markRepo.findOne({ where: { sessionId, studentId: m.studentId } });
      if (existing) {
        existing.status = m.status;
        existing.note = m.note ?? null;
        await this.markRepo.save(existing);
      } else {
        await this.markRepo.save(this.markRepo.create({ sessionId, studentId: m.studentId, status: m.status, note: m.note ?? null }));
      }
    }

    const dateStr = session.date;
    for (const m of marks) {
      const links = await this.psRepo.find({ where: { studentId: m.studentId } });
      for (const link of links) {
        await this.notifications.createForUser(link.parentId, {
          type: 'attendance',
          title: 'Attendance recorded',
          body: `Your child was marked "${m.status}" on ${dateStr}.`,
          payloadJson: JSON.stringify({ sessionId, studentId: m.studentId, status: m.status, date: dateStr }),
        });
      }
    }

    const touched = [...new Set(marks.map((m) => m.studentId))];
    await this.gamification.afterAttendanceMarksSaved(session.classOfferingId, session.date, touched);

    return this.markRepo.find({ where: { sessionId } });
  }

  async getMarks(sessionId: string) {
    return this.markRepo.find({ where: { sessionId } });
  }

  async reportStudent(studentId: string) {
    const marks = await this.markRepo.find({ where: { studentId } });
    const enriched = await Promise.all(
      marks.map(async (m) => {
        const s = await this.sessRepo.findOne({ where: { id: m.sessionId } });
        return {
          status: m.status,
          sessionId: m.sessionId,
          sessionDate: s?.date ?? null,
          classOfferingId: s?.classOfferingId ?? null,
        };
      }),
    );
    return { studentId, marks: enriched };
  }

  async reportClass(classOfferingId: string) {
    const sessions = await this.sessRepo.find({ where: { classOfferingId } });
    const out = [];
    for (const s of sessions) {
      const marks = await this.markRepo.find({ where: { sessionId: s.id } });
      out.push({ sessionId: s.id, date: s.date, marks });
    }
    return { classOfferingId, sessions: out };
  }
}
