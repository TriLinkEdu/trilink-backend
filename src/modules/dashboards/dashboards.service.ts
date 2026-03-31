import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { ClassOffering } from '../class-offerings/entities/class-offering.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { ExamAttempt } from '../exams/entities/exam-attempt.entity';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';

@Injectable()
export class DashboardsService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(ClassOffering) private readonly classes: Repository<ClassOffering>,
    @InjectRepository(Enrollment) private readonly enr: Repository<Enrollment>,
    @InjectRepository(Notification) private readonly notif: Repository<Notification>,
    @InjectRepository(ExamAttempt) private readonly attempts: Repository<ExamAttempt>,
    @InjectRepository(ParentStudent) private readonly ps: Repository<ParentStudent>,
  ) {}

  async admin() {
    const [admin, teacher, student, parent] = await Promise.all([
      this.users.count({ where: { role: UserRole.ADMIN } }),
      this.users.count({ where: { role: UserRole.TEACHER } }),
      this.users.count({ where: { role: UserRole.STUDENT } }),
      this.users.count({ where: { role: UserRole.PARENT } }),
    ]);
    const classes = await this.classes.count();
    const enrollments = await this.enr.count();
    return { users: { admin, teacher, student, parent, total: admin + teacher + student + parent }, classes, enrollments };
  }

  async teacher(userId: string) {
    const myClasses = await this.classes.count({ where: { teacherId: userId } });
    const pendingGrade = await this.attempts
      .createQueryBuilder('a')
      .innerJoin('exams', 'e', 'e.id = a.exam_id')
      .where('a.submitted_at IS NOT NULL')
      .andWhere('a.score IS NULL')
      .andWhere('e.created_by_id = :uid', { uid: userId })
      .getCount();
    const unread = await this.notif.count({ where: { userId, readAt: IsNull() } });
    return { myClasses, pendingGradingApprox: pendingGrade, unreadNotifications: unread };
  }

  async student(userId: string) {
    const myEnrollments = await this.enr.count({ where: { studentId: userId, status: 'active' } });
    const unread = await this.notif.count({ where: { userId, readAt: IsNull() } });
    return { activeEnrollments: myEnrollments, unreadNotifications: unread };
  }

  async parent(userId: string) {
    const children = await this.ps.count({ where: { parentId: userId } });
    const unread = await this.notif.count({ where: { userId, readAt: IsNull() } });
    return { linkedChildren: children, unreadNotifications: unread };
  }
}
