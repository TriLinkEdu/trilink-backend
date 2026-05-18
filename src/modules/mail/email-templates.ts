// Professional email templates for TriLink Education Platform
// Modern, responsive design with logo integration

export interface EmailTemplateData {
  firstName: string;
  title?: string;
  tempPassword?: string;
  loginUrl?: string;
  linkLabel?: string;
  content?: string;
  actionText?: string;
  actionUrl?: string;
  footerText?: string;
  year?: number;
}

const LOGO_URL = 'https://trilink.edu.et/trilink-logo.png';
const PRIMARY_COLOR = '#4F46E5'; // Indigo-600
const SECONDARY_COLOR = '#1E293B'; // Slate-800
const ACCENT_COLOR = '#10B981'; // Emerald-500

function getBaseTemplate(content: string, footerContent: string = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>TriLink Education</title>
  <style>
    /* Reset styles */
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    /* Base styles */
    body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    /* Container */
    .email-wrapper {
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    /* Header */
    .header {
      background: linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${SECONDARY_COLOR} 100%);
      padding: 40px 30px;
      text-align: center;
    }
    .logo {
      width: 180px;
      height: auto;
      margin-bottom: 16px;
    }
    .header-title {
      color: #ffffff;
      font-size: 24px;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.5px;
    }
    .header-subtitle {
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      margin-top: 8px;
    }
    /* Content */
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 20px;
      font-weight: 600;
      color: ${SECONDARY_COLOR};
      margin-bottom: 20px;
    }
    .body-text {
      font-size: 16px;
      line-height: 1.7;
      color: #475569;
      margin-bottom: 24px;
    }
    /* Cards */
    .info-card {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border-left: 4px solid ${PRIMARY_COLOR};
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
    }
    .info-card-title {
      font-size: 12px;
      font-weight: 600;
      color: ${PRIMARY_COLOR};
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .info-card-value {
      font-size: 20px;
      font-weight: 700;
      color: ${SECONDARY_COLOR};
      font-family: 'SF Mono', Monaco, monospace;
      letter-spacing: 2px;
    }
    /* Button */
    .button-container {
      text-align: center;
      margin: 32px 0;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, ${PRIMARY_COLOR} 0%, #6366f1 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 16px 32px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 16px;
      box-shadow: 0 4px 14px 0 rgba(79, 70, 229, 0.39);
      transition: all 0.3s ease;
    }
    /* Security notice */
    .security-notice {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 8px;
      padding: 16px;
      margin: 24px 0;
      font-size: 14px;
      color: #92400e;
    }
    .security-notice strong {
      display: block;
      margin-bottom: 4px;
    }
    /* Features list */
    .features {
      list-style: none;
      padding: 0;
      margin: 20px 0;
    }
    .features li {
      padding: 8px 0;
      padding-left: 28px;
      position: relative;
      color: #475569;
    }
    .features li::before {
      content: "✓";
      position: absolute;
      left: 0;
      color: ${ACCENT_COLOR};
      font-weight: bold;
    }
    /* Footer */
    .footer {
      background: #f8fafc;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    .footer-text {
      font-size: 14px;
      color: #64748b;
      margin-bottom: 16px;
    }
    .footer-links {
      margin: 16px 0;
    }
    .footer-link {
      color: ${PRIMARY_COLOR};
      text-decoration: none;
      margin: 0 12px;
      font-size: 14px;
    }
    .social-links {
      margin: 20px 0;
    }
    .social-icon {
      display: inline-block;
      width: 36px;
      height: 36px;
      background: ${SECONDARY_COLOR};
      border-radius: 50%;
      margin: 0 6px;
      text-align: center;
      line-height: 36px;
      color: #ffffff;
      text-decoration: none;
      font-size: 14px;
    }
    .copyright {
      font-size: 12px;
      color: #94a3b8;
      margin-top: 20px;
    }
    /* Responsive */
    @media screen and (max-width: 600px) {
      .email-wrapper {
        width: 100% !important;
        border-radius: 0 !important;
      }
      .header, .content, .footer {
        padding: 30px 20px !important;
      }
      .button {
        display: block !important;
        text-align: center !important;
      }
    }
  </style>
</head>
<body>
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <div class="email-wrapper">
          <!-- Header -->
          <div class="header">
            <img src="${LOGO_URL}" alt="TriLink Education" class="logo" />
            <h1 class="header-title">TriLink Education</h1>
            <p class="header-subtitle">Connecting Students, Teachers & Parents</p>
          </div>
          
          <!-- Content -->
          <div class="content">
            ${content}
          </div>
          
          <!-- Footer -->
          <div class="footer">
            <p class="footer-text">${footerContent || 'Thank you for being part of the TriLink community.'}</p>
            <div class="footer-links">
              <a href="https://trilink.edu.et" class="footer-link">Visit Website</a>
              <a href="https://trilink.edu.et/support" class="footer-link">Support</a>
              <a href="https://trilink.edu.et/contact" class="footer-link">Contact</a>
            </div>
            <div class="social-links">
              <a href="#" class="social-icon">f</a>
              <a href="#" class="social-icon">t</a>
              <a href="#" class="social-icon">in</a>
            </div>
            <p class="copyright">© ${new Date().getFullYear()} TriLink Education. All rights reserved.</p>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getWelcomeEmailTemplate(data: EmailTemplateData): string {
  const { firstName, tempPassword, loginUrl, linkLabel } = data;
  
  const content = `
    <p class="greeting">Hello ${escapeHtml(firstName)}! 👋</p>
    
    <p class="body-text">
      Welcome to <strong>TriLink Education</strong> — the comprehensive platform that connects students, teachers, and parents for a seamless learning experience.
    </p>
    
    <div class="info-card">
      <div class="info-card-title">Your Temporary Password</div>
      <div class="info-card-value">${escapeHtml(tempPassword || '')}</div>
    </div>
    
    <div class="security-notice">
      <strong>🔒 Security Notice</strong>
      For your security, please sign in and change this temporary password immediately after your first login.
    </div>
    
    <p class="body-text">
      With TriLink, you can:
    </p>
    <ul class="features">
      <li>Access assignments and submit work online</li>
      <li>Track grades and academic progress in real-time</li>
      <li>Communicate directly with teachers and parents</li>
      <li>Participate in interactive online exams</li>
      <li>View schedules and manage your academic calendar</li>
    </ul>
    
    ${loginUrl ? `
    <div class="button-container">
      <a href="${escapeHtml(loginUrl)}" class="button">${escapeHtml(linkLabel || 'Sign In Now')}</a>
    </div>
    ` : ''}
    
    <p class="body-text" style="font-size: 14px; color: #64748b;">
      If you have any questions or need assistance, our support team is here to help at 
      <a href="mailto:support@trilink.edu.et" style="color: ${PRIMARY_COLOR};">support@trilink.edu.et</a>
    </p>
  `;
  
  return getBaseTemplate(content, 'Welcome to the TriLink family! 🎓');
}

export function getPasswordResetTemplate(data: EmailTemplateData): string {
  const { firstName, tempPassword, loginUrl, linkLabel } = data;
  
  const content = `
    <p class="greeting">Password Reset Request</p>
    
    <p class="body-text">
      Hi ${escapeHtml(firstName)},
    </p>
    
    <p class="body-text">
      We received a request to reset your TriLink account password. Your new temporary password has been generated:
    </p>
    
    <div class="info-card">
      <div class="info-card-title">Your New Temporary Password</div>
      <div class="info-card-value">${escapeHtml(tempPassword || '')}</div>
    </div>
    
    <div class="security-notice">
      <strong>⚠️ Important</strong>
      Please sign in with this temporary password and change it to a secure password of your choice immediately.
    </div>
    
    ${loginUrl ? `
    <div class="button-container">
      <a href="${escapeHtml(loginUrl)}" class="button">${escapeHtml(linkLabel || 'Sign In & Change Password')}</a>
    </div>
    ` : ''}
    
    <p class="body-text" style="font-size: 14px; color: #64748b;">
      If you didn't request this password reset, please contact our support team immediately at 
      <a href="mailto:security@trilink.edu.et" style="color: ${PRIMARY_COLOR};">security@trilink.edu.et</a>
    </p>
  `;
  
  return getBaseTemplate(content, 'Need help? Contact our security team anytime.');
}

export function getNotificationTemplate(data: EmailTemplateData): string {
  const { firstName, title, content, actionText, actionUrl } = data;
  
  const bodyContent = `
    <p class="greeting">Hi ${escapeHtml(firstName)},</p>
    
    ${title ? `<h2 style="color: ${SECONDARY_COLOR}; font-size: 18px; margin-bottom: 16px;">${escapeHtml(title)}</h2>` : ''}
    
    <div class="body-text">
      ${content || ''}
    </div>
    
    ${actionUrl && actionText ? `
    <div class="button-container">
      <a href="${escapeHtml(actionUrl)}" class="button">${escapeHtml(actionText)}</a>
    </div>
    ` : ''}
  `;
  
  return getBaseTemplate(bodyContent);
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
