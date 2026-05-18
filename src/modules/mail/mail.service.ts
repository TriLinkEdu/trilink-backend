import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transporter, createTransport } from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { UserRole } from '../users/entities/user.entity';
import { getWelcomeEmailTemplate } from './email-templates';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transport: Transporter<SMTPTransport.SentMessageInfo> | null = null;

  constructor(private readonly config: ConfigService) {
    this.initTransport();
  }

  isConfigured(): boolean {
    return this.transport !== null;
  }

  private initTransport() {
    const host = (this.config.get<string>('mail.host') || '').trim();
    if (!host) {
      this.logger.warn('SMTP not configured (set SMTP_HOST); emails will not be sent.');
      return;
    }
    const port = this.config.get<number>('mail.port') ?? 587;
    const secure = this.config.get<boolean>('mail.secure') ?? false;
    const user = (this.config.get<string>('mail.user') || '').trim();
    // Gmail app passwords are displayed with spaces but must be sent without them
    const pass = (this.config.get<string>('mail.pass') || '').replace(/\s+/g, '');

    this.transport = createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
    });
    this.logger.log(`SMTP configured: ${host}:${port} (secure=${secure}, user=${user || '<none>'})`);
  }

  async sendRegistrationEmail(
    to: string,
    firstName: string,
    tempPassword: string,
    role: UserRole,
  ): Promise<void> {
    const transport = this.transport;
    if (!transport) {
      throw new Error('SMTP is not configured');
    }

    const from = this.config.get<string>('mail.from') ?? 'TriLink <noreply@trilink.edu.et>';
    const loginUrl = this.resolveLoginUrlForRole(role);
    const linkLabel = this.signInLinkLabel(role);

    // Use the new professional HTML template
    const html = getWelcomeEmailTemplate({
      firstName,
      tempPassword,
      loginUrl,
      linkLabel,
    });

    // Keep a simple text version for clients that don't support HTML
    const text = this.buildText(firstName, tempPassword, loginUrl, linkLabel);

    await transport.sendMail({
      from,
      to,
      subject: '🎓 Welcome to TriLink Education — Your Account is Ready!',
      text,
      html,
    });

    this.logger.log(`Welcome email sent to ${to} (role=${role})`);
  }

  private resolveLoginUrlForRole(role: UserRole): string {
    const urls = this.config.get<{ student: string; teacher: string; parent: string }>('mail.loginUrls');
    if (!urls) return '';
    switch (role) {
      case UserRole.STUDENT:
        return urls.student;
      case UserRole.TEACHER:
        return urls.teacher;
      case UserRole.PARENT:
        return urls.parent;
      default:
        return '';
    }
  }

  private signInLinkLabel(role: UserRole): string {
    switch (role) {
      case UserRole.STUDENT:
        return 'Sign In as Student';
      case UserRole.TEACHER:
        return 'Sign In as Teacher';
      case UserRole.PARENT:
        return 'Sign In as Parent';
      default:
        return 'Sign In to TriLink';
    }
  }

  private buildText(firstName: string, tempPassword: string, loginUrl: string, linkLabel: string): string {
    const lines = [
      `Hello ${firstName},`,
      '',
      'Welcome to TriLink Education — the comprehensive platform that connects students, teachers, and parents.',
      '',
      'Your temporary password is:',
      tempPassword,
      '',
      'For your security, please sign in and change this password immediately after your first login.',
    ];
    if (loginUrl) {
      lines.push('', `${linkLabel}: ${loginUrl}`);
    }
    lines.push('', 'Need help? Contact us at support@trilink.edu.et');
    return lines.join('\n');
  }
}
