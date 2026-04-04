import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('mail.host')?.trim();
  }

  private createTransport(): Transporter | null {
    const host = this.config.get<string>('mail.host')?.trim();
    if (!host) return null;
    const port = this.config.get<number>('mail.port') ?? 587;
    const user = this.config.get<string>('mail.user')?.trim();
    const pass = this.config.get<string>('mail.pass');
    const secure = this.config.get<boolean>('mail.secure') ?? false;
    const auth =
      user && pass !== undefined && pass !== ''
        ? { auth: { user, pass } }
        : {};
    return nodemailer.createTransport({
      host,
      port,
      secure,
      ...auth,
    });
  }

  async sendRegistrationCredentials(
    to: string,
    firstName: string,
    tempPassword: string,
    role: UserRole,
  ): Promise<void> {
    const transport = this.createTransport();
    if (!transport) {
      throw new Error('SMTP is not configured');
    }
    const from = this.config.get<string>('mail.from') ?? 'TriLink <noreply@localhost>';
    const loginUrl = this.resolveLoginUrlForRole(role);
    const linkLabel = this.signInLinkLabel(role);
    const text = this.buildText(firstName, tempPassword, loginUrl, linkLabel);
    const html = this.buildHtml(firstName, tempPassword, loginUrl, linkLabel);
    await transport.sendMail({
      from,
      to,
      subject: 'Your TriLink account',
      text,
      html,
    });
    this.logger.log(`Registration email sent to ${to} (role=${role})`);
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
        return 'Open student sign-in';
      case UserRole.TEACHER:
        return 'Open teacher sign-in';
      case UserRole.PARENT:
        return 'Open parent sign-in';
      default:
        return 'Open TriLink sign-in';
    }
  }

  private buildText(firstName: string, tempPassword: string, loginUrl: string, linkLabel: string): string {
    const lines = [
      `Hello ${firstName},`,
      '',
      'An account has been created for you on TriLink.',
      '',
      `Your temporary password is: ${tempPassword}`,
      '',
      'Please sign in and change your password when prompted.',
    ];
    if (loginUrl) {
      lines.push('', `${linkLabel}: ${loginUrl}`);
    }
    return lines.join('\n');
  }

  private buildHtml(firstName: string, tempPassword: string, loginUrl: string, linkLabel: string): string {
    const link = loginUrl
      ? `<p><a href="${this.escapeHtml(loginUrl)}">${this.escapeHtml(linkLabel)}</a></p>`
      : '';
    return `<p>Hello ${this.escapeHtml(firstName)},</p>
<p>An account has been created for you on TriLink.</p>
<p><strong>Temporary password:</strong> <code style="font-size:1.1em">${this.escapeHtml(tempPassword)}</code></p>
<p>Please sign in and change your password when prompted.</p>
${link}`;
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
