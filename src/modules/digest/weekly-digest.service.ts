import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParentStudent } from '../parent-students/entities/parent-student.entity';
import { ReportsService } from '../reports/reports.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class WeeklyDigestService {
  private readonly log = new Logger(WeeklyDigestService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(ParentStudent) private readonly psRepo: Repository<ParentStudent>,
    private readonly reports: ReportsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Monday 08:00 UTC — in-app notification per parent with linked students. */
  @Cron('0 8 * * 1')
  async runWeeklyDigest() {
    const enabled = this.config.get<boolean>('digest.enabled');
    if (enabled === false) return;

    const links = await this.psRepo.find();
    const parentIds = [...new Set(links.map((l) => l.parentId))];
    let sent = 0;
    for (const parentId of parentIds) {
      try {
        const snapshot = await this.reports.buildWeeklyDigestForParent(parentId);
        if (!snapshot?.children?.length) continue;
        const parts: string[] = [];
        for (const c of snapshot.children as Array<{
          name: string | null;
          attendanceThisWeek?: { presentOrLateRate: number | null };
          examsReleasedThisWeek?: number;
        }>) {
          const rate = c.attendanceThisWeek?.presentOrLateRate;
          const rateStr = rate != null ? `${Math.round(rate * 100)}% present/late` : 'attendance n/a';
          parts.push(`${c.name ?? 'Student'}: ${rateStr}, ${c.examsReleasedThisWeek ?? 0} exam(s) released`);
        }
        const body = parts.slice(0, 4).join(' · ') || 'Open the app for your weekly summary.';
        await this.notifications.createForUser(parentId, {
          type: 'weekly_digest',
          title: 'Weekly summary',
          body: body.slice(0, 500),
          payloadJson: JSON.stringify(snapshot),
        });
        sent++;
      } catch (e) {
        this.log.warn(`Digest failed for parent ${parentId}: ${(e as Error).message}`);
      }
    }
    if (sent) this.log.log(`Weekly digest: ${sent} parent notification(s)`);
  }
}
