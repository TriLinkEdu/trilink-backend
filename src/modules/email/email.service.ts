import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { UserRole } from '../users/entities/user.entity';

export interface WelcomeEmailData {
  recipientEmail: string;
  recipientName: string;
  username: string;
  temporaryPassword: string;
  loginUrl: string;
  role: UserRole;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    // Configure SMTP transporter
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port: this.config.get<number>('SMTP_PORT', 587),
      secure: this.config.get<boolean>('SMTP_SECURE', false),
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASSWORD'),
      },
    });
  }

  /**
   * Send welcome email with temporary password
   */
  async sendWelcomeEmail(data: WelcomeEmailData): Promise<EmailResult> {
    try {
      const htmlContent = this.generateWelcomeTemplate(data);
      const fromName = this.config.get<string>('SMTP_FROM_NAME', 'TriLink School');
      const fromEmail = this.config.get<string>('SMTP_FROM_EMAIL');

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: data.recipientEmail,
        subject: 'Welcome to TriLink - Your Account Details',
        html: htmlContent,
      };

      this.logger.log(`Sending welcome email to ${data.recipientEmail}`);
      const info = await this.transporter.sendMail(mailOptions);

      this.logger.log(`Email sent successfully to ${data.recipientEmail}. Message ID: ${info.messageId}`);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      this.logger.error(`Failed to send email to ${data.recipientEmail}: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate HTML template for welcome email
   */
  private generateWelcomeTemplate(data: WelcomeEmailData): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      background: #4A90E2;
      color: white;
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .content {
      padding: 30px 20px;
    }
    .credentials {
      background: #f9f9f9;
      padding: 20px;
      border-left: 4px solid #4A90E2;
      margin: 20px 0;
      border-radius: 4px;
    }
    .credentials p {
      margin: 10px 0;
    }
    .credentials strong {
      color: #4A90E2;
    }
    .button {
      display: inline-block;
      padding: 12px 30px;
      background: #4A90E2;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      margin: 20px 0;
      font-weight: bold;
    }
    .button:hover {
      background: #357ABD;
    }
    .button-container {
      text-align: center;
    }
    .important {
      background: #FFF3CD;
      border-left: 4px solid #FFC107;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .footer {
      text-align: center;
      padding: 20px;
      font-size: 12px;
      color: #666;
      background: #f9f9f9;
    }
    .footer p {
      margin: 5px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to TriLink</h1>
    </div>
    <div class="content">
      <p>Hello <strong>${data.recipientName}</strong>,</p>
      <p>Your account has been successfully created in the TriLink School Management System. Below are your login credentials:</p>
      
      <div class="credentials">
        <p><strong>Username/Email:</strong> ${data.username}</p>
        <p><strong>Temporary Password:</strong> <code style="background: #e8e8e8; padding: 4px 8px; border-radius: 3px; font-size: 14px;">${data.temporaryPassword}</code></p>
        <p><strong>Role:</strong> ${data.role}</p>
      </div>

      <div class="button-container">
        <a href="${data.loginUrl}" class="button">Log In Now</a>
      </div>

      <div class="important">
        <p><strong>⚠️ Important:</strong> You will be required to change your password on first login for security purposes.</p>
      </div>

      <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
      
      <p>Best regards,<br>
      <strong>TriLink School Administration</strong></p>
    </div>
    <div class="footer">
      <p>If you have any questions, please contact <a href="mailto:support@school.com">support@school.com</a></p>
      <p>&copy; ${new Date().getFullYear()} TriLink School Management System. All rights reserved.</p>
      <p style="font-size: 10px; color: #999; margin-top: 10px;">
        This is an automated message. Please do not reply to this email.
      </p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }
}
