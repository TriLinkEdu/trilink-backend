import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Question } from './entities/question.entity';
import { Exam } from './entities/exam.entity';
import { ExamQuestion } from './entities/exam-question.entity';
import { ExamAttempt } from './entities/exam-attempt.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { GradeEntry, GradeEntryType } from '../grades/entities/grade-entry.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { GamificationService } from '../gamification/gamification.service';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { ClassOfferingsService } from '../class-offerings/class-offerings.service';
import { EventsGateway } from '../realtime/events.gateway';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { Grade } from '../school-structure/entities/grade.entity';
import { Section } from '../school-structure/entities/section.entity';
import { Subject } from '../school-structure/entities/subject.entity';
import { GradesService } from '../grades/grades.service';
import { AiService } from '../ai/ai.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

export type ExamCreateInput = {
  title: string;
  academicYearId: string;
  classOfferingId: string | null;
  opensAt: Date;
  closesAt: Date;
  durationMinutes: number;
  minStayMinutes?: number;
  createdById: string;
  maxPoints?: number;
  termId?: string | null;
};

@Injectable()
export class ExamsService {
  private readonly logger = new Logger(ExamsService.name);

  constructor(
    @InjectRepository(Question) private readonly qRepo: Repository<Question>,
    @InjectRepository(Exam) private readonly examRepo: Repository<Exam>,
    @InjectRepository(ExamQuestion) private readonly eqRepo: Repository<ExamQuestion>,
    @InjectRepository(ExamAttempt) private readonly attRepo: Repository<ExamAttempt>,
    @InjectRepository(Enrollment) private readonly enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(ParentStudent) private readonly psRepo: Repository<ParentStudent>,
    @InjectRepository(GradeEntry) private readonly gradeEntryRepo: Repository<GradeEntry>,
    private readonly notifications: NotificationsService,
    private readonly gamification: GamificationService,
    private readonly classOfferings: ClassOfferingsService,
    private readonly events: EventsGateway,
    private readonly gradesService: GradesService,
    private readonly aiService: AiService,
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private assertExamEditor(exam: Exam, viewer: User) {
    if (viewer.role === UserRole.ADMIN) return;
    if (viewer.role === UserRole.TEACHER && exam.createdById === viewer.id) return;
    throw new ForbiddenException('You can only manage exams you created');
  }

  private assertExamQuestionsVisible(exam: Exam, viewer: User) {
    if (viewer.role === UserRole.ADMIN) return;
    if (viewer.role === UserRole.TEACHER && exam.createdById === viewer.id) return;
    if (viewer.role === UserRole.STUDENT && exam.published) return;
    throw new ForbiddenException('Cannot view this exam questions');
  }

  private async assertStudentClassAccess(exam: Exam, studentId: string) {
    if (!exam.classOfferingId) return;
    const enrollment = await this.enrollmentRepo.findOne({
      where: { classOfferingId: exam.classOfferingId, studentId },
    });
    if (!enrollment) {
      throw new ForbiddenException('This exam is not assigned to your class.');
    }
  }

  private async notifyExamResultReleased(attempt: ExamAttempt, exam: Exam) {
    const max = exam.maxPoints ?? 100;
    const scoreLabel = attempt.score != null ? `${attempt.score} / ${max}` : `— / ${max}`;
    const payload = JSON.stringify({
      attemptId: attempt.id,
      examId: exam.id,
      score: attempt.score,
      maxPoints: max,
    });
    await this.notifications.createForUser(attempt.studentId, {
      type: 'exam_result',
      title: 'Exam result published',
      body: `Your result for "${exam.title}" is available (${scoreLabel}).`,
      payloadJson: payload,
    });
    const links = await this.psRepo.find({ where: { studentId: attempt.studentId } });
    for (const link of links) {
      await this.notifications.createForUser(link.parentId, {
        type: 'exam_result',
        title: 'Your child\'s exam result',
        body: `Result for "${exam.title}" is available (${scoreLabel}).`,
        payloadJson: payload,
      });
    }
  }

  private norm(s: unknown): string {
    if (s === undefined || s === null) return '';
    const str = String(s).trim().toLowerCase();
    // Map common index/letter variations
    if (str === '0' || str === 'a' || str === 'true' || str === 't') return '0';
    if (str === '1' || str === 'b' || str === 'false' || str === 'f') return '1';
    if (str === '2' || str === 'c') return '2';
    if (str === '3' || str === 'd') return '3';
    if (str === '4' || str === 'e') return '4';
    return str;
  }

  private autoGradableType(type: string): boolean {
    const t = String(type).trim().toLowerCase();
    return t === 'mcq' || t === 'true_false' || t === 'true-false' || t === 'truefalse' || t === 'fillin' || t === 'fill-in';
  }

  private async syncAttemptToGradeEntry(attempt: ExamAttempt, exam: Exam) {
    if (!exam.classOfferingId) return; // Only sync class-scoped exams for now

    const existing = await this.gradeEntryRepo.findOne({
      where: {
        examAttemptId: attempt.id,
      },
    });

    const data = {
      classOfferingId: exam.classOfferingId,
      studentId: attempt.studentId,
      teacherId: exam.createdById,
      title: exam.title,
      type: GradeEntryType.EXAM,
      score: attempt.score,
      maxScore: exam.maxPoints,
      examAttemptId: attempt.id,
      termId: exam.termId as string,
      releasedAt: attempt.releasedAt,
    };

    if (existing) {
      existing.score = attempt.score;
      existing.maxScore = exam.maxPoints;
      existing.releasedAt = attempt.releasedAt;
      existing.termId = exam.termId as string;
      await this.gradeEntryRepo.save(existing);
    } else {
      // Also try to find by studentId + classOfferingId + title if no attemptId linked yet
      const byTitle = await this.gradeEntryRepo.findOne({
        where: {
          classOfferingId: exam.classOfferingId,
          studentId: attempt.studentId,
          title: exam.title,
        },
      });
      if (byTitle) {
        byTitle.score = attempt.score;
        byTitle.maxScore = exam.maxPoints;
        byTitle.releasedAt = attempt.releasedAt;
        byTitle.examAttemptId = attempt.id;
        byTitle.termId = exam.termId as string;
        await this.gradeEntryRepo.save(byTitle);
      } else {
        await this.gradeEntryRepo.save(
          this.gradeEntryRepo.create({
            classOfferingId: exam.classOfferingId,
            studentId: attempt.studentId,
            teacherId: exam.createdById,
            title: exam.title,
            type: GradeEntryType.EXAM,
            score: attempt.score,
            maxScore: exam.maxPoints,
            examAttemptId: attempt.id,
            termId: exam.termId as string,
            releasedAt: attempt.releasedAt,
          }),
        );
      }
    }
  }

  private async ensureGradeEntriesForClass(exam: Exam) {
    if (!exam.classOfferingId) return;
    const enrollments = await this.enrollmentRepo.find({
      where: { classOfferingId: exam.classOfferingId, status: 'active' },
    });

    for (const en of enrollments) {
      const existing = await this.gradeEntryRepo.findOne({
        where: {
          classOfferingId: exam.classOfferingId,
          studentId: en.studentId,
          title: exam.title,
        },
      });
      if (!existing) {
        await this.gradeEntryRepo.save(
          this.gradeEntryRepo.create({
            classOfferingId: exam.classOfferingId,
            studentId: en.studentId,
            teacherId: exam.createdById,
            title: exam.title,
            type: GradeEntryType.EXAM,
            score: null,
            maxScore: exam.maxPoints,
            termId: exam.termId as string,
          }),
        );
      }
    }
  }

  // Questions
  async createQuestion(body: {
    type: string;
    stem: string;
    optionsJson?: string;
    answerKey?: string;
    attachmentsJson?: string;
    subjectId: string;
    topicId?: string;
    createdById: string;
  }) {
    return this.qRepo.save(this.qRepo.create(body));
  }
  listQuestions(subjectId?: string, skip = 0, take = 50) {
    return this.qRepo.find({
      where: subjectId ? { subjectId } : {},
      relations: ['subject'],
      skip,
      take,
      order: { createdAt: 'DESC' },
    });
  }
  async removeQuestion(id: string) {
    const q = await this.qRepo.findOne({ where: { id } });
    if (!q) throw new NotFoundException('Question not found');
    await this.qRepo.remove(q);
  }

  // Exams
  async createExam(body: ExamCreateInput) {
    const minStay = Math.max(0, Math.floor(body.minStayMinutes ?? 0));
    if (minStay > body.durationMinutes) {
      throw new BadRequestException('minStayMinutes cannot exceed durationMinutes');
    }
    return this.examRepo.save(
      this.examRepo.create({
        title: body.title,
        academicYearId: body.academicYearId,
        classOfferingId: body.classOfferingId,
        opensAt: body.opensAt,
        closesAt: body.closesAt,
        durationMinutes: body.durationMinutes,
        minStayMinutes: minStay,
        createdById: body.createdById,
        maxPoints: body.maxPoints ?? 100,
        termId: body.termId ?? null,
        published: false,
      }),
    );
  }

  async updateExamMaxPoints(examId: string, maxPoints: number, viewer: User) {
    const e = await this.oneExam(examId);
    this.assertExamEditor(e, viewer);
    if (maxPoints < 1 || maxPoints > 10_000) throw new BadRequestException('maxPoints must be between 1 and 10000');
    e.maxPoints = maxPoints;
    return this.examRepo.save(e);
  }
  async listExams(yearId: string | undefined, viewer: User, termId?: string) {
    const qb = this.examRepo.createQueryBuilder('e').orderBy('e.opensAt', 'DESC');
    if (yearId) qb.andWhere('e.academicYearId = :y', { y: yearId });
    if (termId) qb.andWhere('e.termId = :t', { t: termId });
    if (viewer.role === UserRole.STUDENT) {
      qb.andWhere('e.published = :pub', { pub: true });
      const enrollments = await this.enrollmentRepo.find({
        where: yearId ? { studentId: viewer.id, academicYearId: yearId } : { studentId: viewer.id },
      });
      const classIds = [...new Set(enrollments.map((enrollment) => enrollment.classOfferingId))];
      if (classIds.length > 0) {
        qb.andWhere('(e.classOfferingId IS NULL OR e.classOfferingId IN (:...classIds))', { classIds });
      } else {
        qb.andWhere('e.classOfferingId IS NULL');
      }
    } else if (viewer.role === UserRole.TEACHER) {
      qb.andWhere('e.createdById = :uid', { uid: viewer.id });
    }
    const exams = await qb.getMany();

    const classOfferingIds = [...new Set(exams.map((e) => e.classOfferingId).filter((id): id is string => !!id))];
    if (!classOfferingIds.length) {
      return Promise.all(
        exams.map(async (e) => {
          const questionCount = await this.eqRepo.count({ where: { examId: e.id } });
          let attempts: ExamAttempt[] = [];
          if (viewer.role === UserRole.STUDENT) {
            attempts = await this.attRepo.find({
              where: { examId: e.id, studentId: viewer.id },
            });
          }
          return {
            ...e,
            questionCount,
            attempts,
            classOffering: null,
          };
        })
      );
    }

    const offerings = await this.classOfferings.listByIds(classOfferingIds);
    const classMap = new Map(offerings.map((co) => [co.id, co] as const));

    return Promise.all(
      exams.map(async (e) => {
        const questionCount = await this.eqRepo.count({ where: { examId: e.id } });
        let attempts: ExamAttempt[] = [];
        if (viewer.role === UserRole.STUDENT) {
          attempts = await this.attRepo.find({
            where: { examId: e.id, studentId: viewer.id },
          });
        }
        return {
          ...e,
          questionCount,
          attempts,
          classOffering: e.classOfferingId ? classMap.get(e.classOfferingId) ?? null : null,
        };
      }),
    );
  }
  async oneExam(id: string) {
    const e = await this.examRepo.findOne({ where: { id } });
    if (!e) throw new NotFoundException('Exam not found');
    return e;
  }
  async addQuestions(
    examId: string,
    items: { questionId: string; orderIndex: number; points: number }[],
    viewer: User,
  ) {
    const ex = await this.oneExam(examId);
    this.assertExamEditor(ex, viewer);
    for (const it of items) {
      await this.eqRepo.save(this.eqRepo.create({ examId, ...it }));
    }
    return this.eqRepo.find({ where: { examId }, order: { orderIndex: 'ASC' } });
  }
  async listExamQuestions(examId: string, viewer: User) {
    const ex = await this.oneExam(examId);
    this.assertExamQuestionsVisible(ex, viewer);

    if (viewer.role === UserRole.STUDENT) {
      await this.assertStudentClassAccess(ex, viewer.id);
    }

    const rows = (await this.eqRepo.find({ where: { examId: examId }, order: { orderIndex: 'ASC' } })) as ExamQuestion[];
    const qIds = Array.from(new Set(rows.map((r: ExamQuestion) => r.questionId)));
    const questions = qIds.length ? await this.qRepo.find({ where: { id: In(qIds) } }) : [];
    const qMap = new Map(questions.map((q: Question) => [q.id, q]));

    return rows.map((row) => {
      const q = qMap.get(row.questionId);
      const base = {
        id: row.questionId,
        examQuestionId: row.id,
        questionId: row.questionId,
        examId: row.examId,
        orderIndex: row.orderIndex,
        points: row.points,
        type: q?.type ?? 'mcq',
        stem: q?.stem ?? '',
        optionsJson: q?.optionsJson ?? null,
      };
      if (viewer.role === UserRole.STUDENT) return base;
      return { ...base, answerKey: q?.answerKey ?? null };
    });
  }
  async publish(examId: string, viewer: User) {
    const e = await this.oneExam(examId);
    this.assertExamEditor(e, viewer);
    const n = await this.eqRepo.count({ where: { examId } });
    if (n === 0) throw new BadRequestException('Add questions before publish');
    e.published = true;
    const saved = await this.examRepo.save(e);
    await this.ensureGradeEntriesForClass(saved);
    return saved;
  }

  async startAttempt(examId: string, studentId: string) {
    const e = await this.oneExam(examId);
    if (!e.published) throw new BadRequestException('Exam not published');
    const now = new Date();
    if (now < e.opensAt || now > e.closesAt) throw new BadRequestException('Outside exam window');
    const u = await this.userRepo.findOne({ where: { id: studentId } });
    if (!u || u.role !== UserRole.STUDENT) throw new BadRequestException('Must be student');
    await this.assertStudentClassAccess(e, studentId);
    const dup = await this.attRepo.findOne({ where: { examId, studentId } });
    if (dup) {
      if (dup.submittedAt) throw new ConflictException('Attempt already submitted');
      if (dup.isLocked && !dup.reentryAllowed) {
        throw new ForbiddenException('Attempt is locked. Wait for teacher re-entry approval.');
      }
      if (dup.reentryAllowed) {
        dup.reentryAllowed = false;
        dup.isLocked = false;
        dup.lockReason = null;
        dup.lockedAt = null;
      }
      const resumed = await this.attRepo.save(dup);
      this.events.emitToUser(e.createdById, 'attempt:activity', {
        attemptId: resumed.id,
        examId: resumed.examId,
        studentId: resumed.studentId,
        kind: 'resume',
        status: resumed.submittedAt ? 'submitted' : 'in_progress',
        timestamp: new Date().toISOString(),
      });
      return resumed;
    }
    const created = await this.attRepo.save(
      this.attRepo.create({
        examId,
        studentId,
        startedAt: now,
        answersJson: '{}',
        needsManualGrading: false,
      }),
    );
    this.events.emitToUser(e.createdById, 'attempt:activity', {
      attemptId: created.id,
      examId: created.examId,
      studentId: created.studentId,
      kind: 'start',
      status: 'in_progress',
      timestamp: new Date().toISOString(),
    });
    return created;
  }

  async saveAnswers(attemptId: string, answersJson: string) {
    const a = await this.attRepo.findOne({ where: { id: attemptId } });
    if (!a) throw new NotFoundException('Attempt not found');
    if (a.submittedAt) throw new BadRequestException('Already submitted');
    a.answersJson = answersJson;
    return this.attRepo.save(a);
  }

  private async computeAndApplyAutoGrade(attemptId: string) {
    const a = await this.attRepo.findOne({ where: { id: attemptId } });
    if (!a?.submittedAt) return;
    const exam = await this.examRepo.findOne({ where: { id: a.examId } });
    if (!exam) return;
    const rows = await this.eqRepo.find({ where: { examId: a.examId }, order: { orderIndex: 'ASC' } });
    let answers: Record<string, string> = {};
    try {
      answers = JSON.parse(a.answersJson || '{}');
    } catch {
      answers = {};
    }

    const perQuestion: Array<{
      questionId: string;
      pointsMax: number;
      pointsEarned: number;
      autoGraded: boolean;
    }> = [];

    let needsManual = false;
    let totalWeight = 0;
    let earnedWeight = 0;

    for (const row of rows) {
      const q = await this.qRepo.findOne({ where: { id: row.questionId } });
      if (!q) continue;
      totalWeight += row.points;
      const raw = answers[q.id];
      const hasAnswer = raw !== undefined && raw !== null && String(raw).trim() !== '';

      let earned = 0;
      let autoGraded = false;
      let isCorrectForBKT = false;
      
      if (this.autoGradableType(q.type) && q.answerKey != null && q.answerKey !== '') {
        autoGraded = true;
        if (hasAnswer && this.norm(raw) === this.norm(q.answerKey)) {
          earned = row.points;
          isCorrectForBKT = true;
        } else if (hasAnswer) {
          isCorrectForBKT = false;
        }
      } else {
        needsManual = true;
        earned = 0;
      }
      
      // Fire BKT update hook for auto-graded questions that were actually answered
      if (autoGraded && hasAnswer) {
        const aiBase = this.config.get<string>('aiEngineUrl') || 'http://localhost:4001';
        const aiKey = this.config.get<string>('aiEngineApiKey') || '';
        this.http.post(
          `${aiBase}/api/ai/mastery/update`,
          {
            student_id: a.studentId,
            topic_id: q.topicId ?? q.subjectId, // Use specific topicId if available, else fallback to subject scope
            is_correct: isCorrectForBKT,
          },
          { headers: { 'x-api-key': aiKey } }
        ).subscribe({
          error: (err: Error) => this.logger.debug(`Failed to update BKT mastery for ${a.studentId}`, err.message),
        });
      }

      earnedWeight += earned;
      perQuestion.push({
        questionId: q.id,
        pointsMax: row.points,
        pointsEarned: earned,
        autoGraded,
      });
    }

    const maxPoints = exam.maxPoints ?? 100;
    const scaled =
      totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * maxPoints * 100) / 100 : 0;

    const breakdown = {
      examMaxPoints: maxPoints,
      totalQuestionPoints: totalWeight,
      weightedEarned: earnedWeight,
      perQuestion,
      computedAutoScore: scaled,
    };

    a.autoScore = scaled;
    a.breakdownJson = JSON.stringify(breakdown);
    a.needsManualGrading = needsManual;
    a.score = scaled;
    await this.attRepo.save(a);
    await this.syncAttemptToGradeEntry(a, exam);
  }

  async submit(attemptId: string) {
    const a = await this.attRepo.findOne({ where: { id: attemptId } });
    if (!a) throw new NotFoundException('Attempt not found');
    if (a.submittedAt) throw new BadRequestException('Already submitted');
    a.submittedAt = new Date();
    await this.attRepo.save(a);
    await this.computeAndApplyAutoGrade(attemptId);
    const refreshed = await this.attRepo.findOne({ where: { id: attemptId } });
    if (refreshed) {
      const exam = await this.examRepo.findOne({ where: { id: refreshed.examId } });
      if (exam) {
        await this.ensureGradeEntriesForClass(exam);
        this.events.emitToUser(exam.createdById, 'attempt:activity', {
          attemptId: refreshed.id,
          examId: refreshed.examId,
          studentId: refreshed.studentId,
          kind: 'submit',
          status: 'submitted',
          timestamp: new Date().toISOString(),
        });
        const student = await this.userRepo.findOne({ where: { id: refreshed.studentId } });
        const name = student ? `${student.firstName} ${student.lastName}` : 'A student';
        await this.notifications.createForUser(exam.createdById, {
          type: 'exam_submission',
          title: 'New exam submission',
          body: `${name} submitted "${exam.title}".${refreshed.needsManualGrading ? ' Manual grading may be required.' : ''}`,
          payloadJson: JSON.stringify({
            attemptId: refreshed.id,
            examId: exam.id,
            studentId: refreshed.studentId,
            needsManualGrading: refreshed.needsManualGrading,
          }),
        });
        await this.syncAttemptToGradeEntry(refreshed, exam);
      }
    }
    return refreshed;
  }

  async grade(attemptId: string, score: number, viewer: User) {
    const a = await this.attRepo.findOne({ where: { id: attemptId } });
    if (!a) throw new NotFoundException('Attempt not found');
    if (!a.submittedAt) throw new BadRequestException('Not submitted yet');
    const exam = await this.examRepo.findOne({ where: { id: a.examId } });
    if (!exam) throw new NotFoundException('Exam not found');
    this.assertExamEditor(exam, viewer);
    const max = exam.maxPoints ?? 100;
    if (score < 0 || score > max) {
      throw new BadRequestException(`Score must be between 0 and ${max} (exam maxPoints)`);
    }
    a.score = score;
    const saved = await this.attRepo.save(a);
    await this.syncAttemptToGradeEntry(saved, exam);
    return saved;
  }

  async release(attemptId: string, viewer: User) {
    const a = await this.attRepo.findOne({ where: { id: attemptId } });
    if (!a) throw new NotFoundException('Attempt not found');
    const exam = await this.examRepo.findOne({ where: { id: a.examId } });
    if (!exam) throw new NotFoundException('Exam not found');
    this.assertExamEditor(exam, viewer);
    const alreadyReleased = !!a.releasedAt;
    a.releasedAt = new Date();
    const saved = await this.attRepo.save(a);
    await this.syncAttemptToGradeEntry(saved, exam);
    
    // Notify AI Core about the results for mastery tracking
    void this.syncAttemptToAiCore(saved, viewer).catch((e: any) => {
      this.logger.warn(`AI Core sync failed for attempt ${saved.id}: ${e.message}`);
    });

    if (!alreadyReleased) {
      await this.notifyExamResultReleased(saved, exam);
      await this.gamification.handleExamReleased(saved, exam);
    }
    return saved;
  }

  async listAttemptsForExam(examId: string, viewer: User) {
    if (viewer.role !== UserRole.ADMIN && viewer.role !== UserRole.TEACHER) {
      throw new ForbiddenException('Only staff can list exam attempts');
    }
    const ex = await this.oneExam(examId);
    this.assertExamEditor(ex, viewer);
    const attempts = await this.attRepo.find({
      where: { examId },
      order: { submittedAt: 'DESC', createdAt: 'DESC' },
    });
    const out: Array<{
      attemptId: string;
      studentId: string;
      studentEmail: string | null;
      firstName: string | null;
      lastName: string | null;
      submittedAt: Date | null;
      releasedAt: Date | null;
      score: number | null;
      autoScore: number | null;
      needsManualGrading: boolean;
    }> = [];
    for (const a of attempts) {
      const u = await this.userRepo.findOne({ where: { id: a.studentId } });
      out.push({
        attemptId: a.id,
        studentId: a.studentId,
        studentEmail: u?.email ?? null,
        firstName: u?.firstName ?? null,
        lastName: u?.lastName ?? null,
        submittedAt: a.submittedAt,
        releasedAt: a.releasedAt,
        score: a.score,
        autoScore: a.autoScore,
        needsManualGrading: a.needsManualGrading,
      });
    }
    return { examId, attempts: out };
  }

  async getAttemptForGrader(attemptId: string, viewer: User) {
    if (viewer.role !== UserRole.ADMIN && viewer.role !== UserRole.TEACHER) {
      throw new ForbiddenException('Only staff can review attempts');
    }
    const a = await this.attRepo.findOne({ where: { id: attemptId } });
    if (!a) throw new NotFoundException('Attempt not found');
    const exam = await this.examRepo.findOne({ where: { id: a.examId } });
    if (!exam) throw new NotFoundException('Exam not found');
    this.assertExamEditor(exam, viewer);
    let answers: unknown = {};
    try {
      answers = JSON.parse(a.answersJson || '{}');
    } catch {
      answers = {};
    }
    let breakdown: unknown = null;
    if (a.breakdownJson) {
      try {
        breakdown = JSON.parse(a.breakdownJson);
      } catch {
        breakdown = null;
      }
    }
    const eqRows = await this.eqRepo.find({
      where: { examId: a.examId },
      order: { orderIndex: 'ASC' },
    });
    const qIds = [...new Set(eqRows.map((eq) => eq.questionId))];
    const questions = qIds.length ? await this.qRepo.find({ where: { id: In(qIds) } }) : [];
    const qMap = new Map(questions.map((q) => [q.id, q]));
    const examQuestions = eqRows.map((eq) => {
      const q = qMap.get(eq.questionId);
      return {
        ...eq,
        question: q
          ? {
              id: q.id,
              type: q.type,
              stem: q.stem,
              optionsJson: q.optionsJson,
              answerKey: q.answerKey,
              attachmentsJson: q.attachmentsJson,
            }
          : null,
      };
    });
    const student = await this.userRepo.findOne({ where: { id: a.studentId } });
    return {
      attempt: {
        id: a.id,
        examId: a.examId,
        studentId: a.studentId,
        startedAt: a.startedAt,
        submittedAt: a.submittedAt,
        releasedAt: a.releasedAt,
        score: a.score,
        autoScore: a.autoScore,
        needsManualGrading: a.needsManualGrading,
        gradedById: a.gradedById,
      },
      exam: {
        id: exam.id,
        title: exam.title,
        maxPoints: exam.maxPoints,
        academicYearId: exam.academicYearId,
        classOfferingId: exam.classOfferingId,
      },
      examQuestions,
      answers,
      breakdown,
      student: student
        ? { id: student.id, email: student.email, firstName: student.firstName, lastName: student.lastName }
        : null,
    };
  }

  async assertCanViewAttempt(attempt: ExamAttempt, viewer: User) {
    if (viewer.role === UserRole.ADMIN || viewer.role === UserRole.TEACHER) {
      return;
    }
    if (viewer.role === UserRole.STUDENT && attempt.studentId === viewer.id) {
      return;
    }
    if (viewer.role === UserRole.PARENT) {
      const link = await this.psRepo.findOne({ where: { parentId: viewer.id, studentId: attempt.studentId } });
      if (link) return;
    }
    throw new ForbiddenException('Cannot view this attempt');
  }

  async getResult(attemptId: string, viewer: User) {
    const a = await this.attRepo.findOne({ where: { id: attemptId } });
    if (!a) throw new NotFoundException('Attempt not found');
    if (!a.releasedAt && viewer.role === UserRole.STUDENT) {
      throw new BadRequestException('Result not released');
    }
    await this.assertCanViewAttempt(a, viewer);
    const exam = await this.examRepo.findOne({ where: { id: a.examId } });
    let answers: unknown = {};
    try {
      answers = JSON.parse(a.answersJson || '{}');
    } catch {
      answers = {};
    }
    let breakdown: unknown = null;
    if (a.breakdownJson) {
      try {
        breakdown = JSON.parse(a.breakdownJson);
      } catch {
        breakdown = null;
      }
    }
    const eqRows = await this.eqRepo.find({
      where: { examId: a.examId },
      order: { orderIndex: 'ASC' },
    });
    const qIds = [...new Set(eqRows.map((eq) => eq.questionId))];
    const questions = qIds.length ? await this.qRepo.find({ where: { id: In(qIds) } }) : [];
    const qMap = new Map(questions.map((q) => [q.id, q]));
    const breakdownData = (breakdown as any)?.perQuestion || [];
    const breakdownMap = new Map<string, any>(breakdownData.map((b: any) => [b.questionId, b]));
    const studentAnswers = (answers as Record<string, any>) || {};

    const formattedQuestions = eqRows.map((eq) => {
      const q = qMap.get(eq.questionId);
      const studentAnswer = String(studentAnswers[eq.questionId] ?? '');
      const bItem = breakdownMap.get(eq.questionId);
      return {
        id: eq.questionId,
        orderIndex: eq.orderIndex,
        points: eq.points,
        type: q?.type ?? 'mcq',
        stem: q?.stem ?? '',
        optionsJson: q?.optionsJson ?? null,
        // Only show answerKey if student can view results (usually when released)
        answerKey: a.releasedAt || viewer.role !== UserRole.STUDENT ? q?.answerKey : null,
        studentAnswer,
        pointsEarned: bItem?.pointsEarned ?? 0,
        isCorrect: bItem ? bItem.pointsEarned === bItem.pointsMax : null,
      };
    });

    const student = await this.userRepo.findOne({ where: { id: a.studentId } });
    return {
      attemptId: a.id,
      examId: a.examId,
      examTitle: exam?.title ?? null,
      maxPoints: exam?.maxPoints ?? 100,
      score: a.score,
      autoScore: a.autoScore,
      needsManualGrading: a.needsManualGrading,
      submittedAt: a.submittedAt,
      releasedAt: a.releasedAt,
      answers,
      breakdown,
      questions: formattedQuestions,
      student: student
        ? { id: student.id, firstName: student.firstName, lastName: student.lastName, email: student.email }
        : null,
    };
  }

  async exportExamResultsCsv(examId: string, viewer: User): Promise<string> {
    const ex = await this.oneExam(examId);
    this.assertExamEditor(ex, viewer);
    const attempts = await this.attRepo.find({ where: { examId } });
    const released = attempts.filter((x) => x.releasedAt);
    const exam = await this.examRepo.findOne({ where: { id: examId } });
    const max = exam?.maxPoints ?? 100;
    const lines = [
      'attemptId,studentId,studentEmail,firstName,lastName,score,maxPoints,autoScore,needsManualGrading,releasedAt',
    ];
    for (const a of released) {
      const u = await this.userRepo.findOne({ where: { id: a.studentId } });
      lines.push(
        [
          a.id,
          a.studentId,
          u?.email ?? '',
          u?.firstName ?? '',
          u?.lastName ?? '',
          a.score ?? '',
          max,
          a.autoScore ?? '',
          a.needsManualGrading ? 'yes' : 'no',
          a.releasedAt?.toISOString() ?? '',
        ]
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(','),
      );
    }
    return lines.join('\n');
  }

  async exportAttemptCsv(attemptId: string, viewer: User): Promise<string> {
    const a = await this.attRepo.findOne({ where: { id: attemptId } });
    if (!a) throw new NotFoundException('Attempt not found');
    if (!a.releasedAt) throw new BadRequestException('Result not released');
    await this.assertCanViewAttempt(a, viewer);
    const exam = await this.examRepo.findOne({ where: { id: a.examId } });
    const u = await this.userRepo.findOne({ where: { id: a.studentId } });
    const max = exam?.maxPoints ?? 100;
    const lines = [
      'field,value',
      `"attemptId","${a.id}"`,
      `"examId","${a.examId}"`,
      `"examTitle","${(exam?.title ?? '').replace(/"/g, '""')}"`,
      `"studentId","${a.studentId}"`,
      `"studentEmail","${(u?.email ?? '').replace(/"/g, '""')}"`,
      `"score","${a.score ?? ''}"`,
      `"maxPoints","${max}"`,
      `"autoScore","${a.autoScore ?? ''}"`,
      `"needsManualGrading","${a.needsManualGrading ? 'yes' : 'no'}"`,
      `"releasedAt","${a.releasedAt?.toISOString() ?? ''}"`,
    ];
    return lines.join('\n');
  }

  // ── Violations (exam integrity) ────────────────────────────────────────────

  async recordViolation(attemptId: string, reason: string): Promise<{ ok: true; locked: boolean; lockReason?: string }> {
    const a = await this.attRepo.findOne({ where: { id: attemptId } });
    if (!a) throw new NotFoundException('Attempt not found');
    if (a.submittedAt) return { ok: true, locked: false };

    let violations: Array<{ reason: string; timestamp: string }> = [];
    try {
      violations = JSON.parse(a.violationsJson || '[]');
    } catch {
      violations = [];
    }

    violations.push({ reason, timestamp: new Date().toISOString() });
    a.violationsJson = JSON.stringify(violations);

    const normalized = this.norm(reason);
    const shouldLock = normalized.includes('tab') || normalized.includes('fullscreen') || normalized.includes('focus');
    if (shouldLock && !a.isLocked) {
      a.isLocked = true;
      a.reentryAllowed = false;
      a.lockReason = reason.slice(0, 255);
      a.lockedAt = new Date();
    }

    await this.attRepo.save(a);

    const exam = await this.examRepo.findOne({ where: { id: a.examId } });
    if (exam) {
      this.events.emitToUser(exam.createdById, 'attempt:violation', {
        attemptId: a.id,
        examId: a.examId,
        studentId: a.studentId,
        reason,
        timestamp: new Date().toISOString(),
        violationCount: violations.length,
      });
      this.events.emitToUser(exam.createdById, 'attempt:activity', {
        attemptId: a.id,
        examId: a.examId,
        studentId: a.studentId,
        kind: shouldLock ? 'locked' : 'violation',
        status: a.submittedAt ? 'submitted' : 'in_progress',
        reason,
        violationCount: violations.length,
        timestamp: new Date().toISOString(),
      });
    }

    return { ok: true, locked: a.isLocked, lockReason: a.lockReason ?? undefined };
  }

  async controlAttempt(attemptId: string, action: 'force_submit' | 'warn' | 'allow_rejoin', message: string, viewer: User) {
    const a = await this.attRepo.findOne({ where: { id: attemptId } });
    if (!a) throw new NotFoundException('Attempt not found');
    const exam = await this.examRepo.findOne({ where: { id: a.examId } });
    if (!exam) throw new NotFoundException('Exam not found');
    this.assertExamEditor(exam, viewer);

    if (action === 'allow_rejoin') {
      a.isLocked = false;
      a.lockReason = null;
      a.lockedAt = null;
      a.reentryAllowed = true;
      await this.attRepo.save(a);
      this.events.emitToUser(a.studentId, 'attempt:control', {
        attemptId: a.id,
        action,
        message: message || 'Teacher allowed you to rejoin the exam.',
      });
      this.events.emitToUser(exam.createdById, 'attempt:activity', {
        attemptId: a.id,
        examId: a.examId,
        studentId: a.studentId,
        kind: 'allow_rejoin',
        status: 'in_progress',
        timestamp: new Date().toISOString(),
      });
      return { success: true };
    }

    this.events.emitToUser(a.studentId, 'attempt:control', {
      attemptId: a.id,
      action,
      message,
    });

    if (action === 'force_submit' && !a.submittedAt) {
      a.submittedAt = new Date();
      await this.attRepo.save(a);
      await this.computeAndApplyAutoGrade(a.id);
      this.events.emitToUser(exam.createdById, 'attempt:activity', {
        attemptId: a.id,
        examId: a.examId,
        studentId: a.studentId,
        kind: 'force_submit',
        status: 'submitted',
        timestamp: new Date().toISOString(),
      });
    } else if (action === 'warn') {
      this.events.emitToUser(exam.createdById, 'attempt:activity', {
        attemptId: a.id,
        examId: a.examId,
        studentId: a.studentId,
        kind: 'warn',
        status: a.submittedAt ? 'submitted' : 'in_progress',
        reason: message,
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true };
  }

  async getViolations(attemptId: string, viewer: User): Promise<Array<{ reason: string; timestamp: string }>> {
    if (viewer.role !== UserRole.ADMIN && viewer.role !== UserRole.TEACHER) {
      throw new ForbiddenException('Only staff can view violations');
    }
    const a = await this.attRepo.findOne({ where: { id: attemptId } });
    if (!a) throw new NotFoundException('Attempt not found');
    try {
      return JSON.parse(a.violationsJson || '[]');
    } catch {
      return [];
    }
  }

  async getExamStudentRoster(examId: string, viewer: User) {
    if (viewer.role !== UserRole.ADMIN && viewer.role !== UserRole.TEACHER) {
      throw new ForbiddenException('Only staff can view the roster');
    }
    const ex = await this.oneExam(examId);
    this.assertExamEditor(ex, viewer);

    const attempts: ExamAttempt[] = await this.attRepo.find({ where: { examId } });
    const attemptMap = new Map<string, ExamAttempt>(attempts.map((attempt) => [attempt.studentId, attempt]));

    let studentIds: string[] = [];
    if (ex.classOfferingId) {
      const enrollmentRepo = this.attRepo.manager.getRepository(Enrollment);
      const enrollments = await enrollmentRepo.find({ where: { classOfferingId: ex.classOfferingId } });
      studentIds = enrollments.map((enrollment) => enrollment.studentId);
    } else {
      studentIds = [...new Set(attempts.map((attempt) => attempt.studentId))];
    }

    const users: User[] = await this.userRepo.find({
      where: { id: In(studentIds) },
      select: ['id', 'firstName', 'lastName', 'email'],
    });
    const userMap = new Map<string, User>(users.map((user) => [user.id, user]));

    const out = studentIds.map((sid) => {
      const u = userMap.get(sid) ?? null;
      const att: ExamAttempt | null = attemptMap.get(sid) ?? null;
      return {
        studentId: sid,
        firstName: u?.firstName ?? null,
        lastName: u?.lastName ?? null,
        email: u?.email ?? null,
        status: att ? (att.submittedAt ? 'submitted' : 'in_progress') : 'not_started',
        score: att?.score ?? null,
        releasedAt: att?.releasedAt ?? null,
        attemptId: att?.id ?? null,
        isLocked: !!att?.isLocked,
        lockReason: att?.lockReason ?? null,
        lockedAt: att?.lockedAt ?? null,
        reentryAllowed: !!att?.reentryAllowed,
        violationCount: att?.violationsJson
          ? (() => {
              try {
                return JSON.parse(att.violationsJson).length;
              } catch {
                return 0;
              }
            })()
          : 0,
      };
    });

    return { examId, classOfferingId: ex.classOfferingId, students: out };
  }

  private async syncAttemptToAiCore(attempt: ExamAttempt, viewer: User) {
    if (!attempt.breakdownJson) return;

    let breakdown: any;
    try {
      breakdown = JSON.parse(attempt.breakdownJson);
    } catch {
      return;
    }

    const perQuestion = (breakdown as any).perQuestion || [];
    if (!perQuestion.length) return;

    // Get all questions in the exam to check for topicId
    const eqRows = await this.eqRepo.find({ where: { examId: attempt.examId } });
    const qIds = eqRows.map((eq) => eq.questionId);
    const questions = await this.qRepo.find({ where: { id: In(qIds) } });
    const qMap = new Map(questions.map((q) => [q.id, q]));

    for (const bItem of perQuestion) {
      const q = qMap.get(bItem.questionId);
      if (q && q.topicId) {
        const isCorrect = bItem.pointsEarned === bItem.pointsMax;
        await this.aiService.masteryUpdate(
          {
            student_id: attempt.studentId,
            topic_id: q.topicId,
            is_correct: isCorrect,
          },
          viewer,
        );
      }
    }
  }
}
