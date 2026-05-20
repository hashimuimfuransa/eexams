const sgMail = require('@sendgrid/mail');

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Email configuration
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@eexams.com';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Brand colors matching the app
const BRAND = {
  primary: '#0D406C',
  accent: '#0CBD73',
  accentLight: '#5AD5A2',
  accentDark: '#067A4C',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  surface: '#FFFFFF',
  surfaceAlt: '#F5FBF8',
  surfaceBorder: '#D7E5DD',
  danger: '#EF4444',
  warning: '#F59E0B',
  success: '#0CBD73',
};

/**
 * Base email template wrapper
 */
const wrapEmail = (content, subject) => {
  return {
    to: null, // Will be set when sending
    from: FROM_EMAIL,
    subject: subject,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #F5FBF8;
      line-height: 1.6;
      color: ${BRAND.textPrimary};
    }
    
    .email-wrapper {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    
    .email-container {
      background: #FFFFFF;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
    }
    
    .email-header {
      background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.accent} 100%);
      padding: 40px 30px;
      text-align: center;
    }
    
    .email-header h1 {
      color: #FFFFFF;
      font-size: 24px;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.02em;
    }
    
    .email-header .logo {
      margin-bottom: 16px;
    }
    
    .email-header .logo-text {
      color: #FFFFFF;
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.03em;
    }
    
    .email-body {
      padding: 40px 30px;
    }
    
    .greeting {
      font-size: 18px;
      font-weight: 600;
      color: ${BRAND.textPrimary};
      margin-bottom: 16px;
    }
    
    .message {
      font-size: 15px;
      color: ${BRAND.textSecondary};
      margin-bottom: 24px;
      line-height: 1.7;
    }
    
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.accent} 100%);
      color: #FFFFFF !important;
      text-decoration: none;
      padding: 16px 32px;
      border-radius: 12px;
      font-weight: 700;
      font-size: 15px;
      box-shadow: 0 8px 24px rgba(12, 189, 115, 0.35);
      margin: 16px 0;
    }
    
    .cta-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 32px rgba(12, 189, 115, 0.45);
    }
    
    .info-box {
      background: ${BRAND.surfaceAlt};
      border: 1px solid ${BRAND.surfaceBorder};
      border-radius: 12px;
      padding: 20px;
      margin: 24px 0;
    }
    
    .info-box-title {
      font-size: 14px;
      font-weight: 700;
      color: ${BRAND.textPrimary};
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .info-box-content {
      font-size: 14px;
      color: ${BRAND.textSecondary};
    }
    
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 100px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    
    .status-badge.pending {
      background: rgba(245, 158, 11, 0.12);
      color: ${BRAND.warning};
    }
    
    .status-badge.approved {
      background: rgba(12, 189, 115, 0.12);
      color: ${BRAND.success};
    }
    
    .status-badge.rejected {
      background: rgba(239, 68, 68, 0.12);
      color: ${BRAND.danger};
    }
    
    .divider {
      height: 1px;
      background: ${BRAND.surfaceBorder};
      margin: 24px 0;
    }
    
    .footer {
      padding: 30px;
      text-align: center;
      background: ${BRAND.surfaceAlt};
    }
    
    .footer-text {
      font-size: 13px;
      color: ${BRAND.textSecondary};
      margin-bottom: 8px;
    }
    
    .footer-links {
      font-size: 13px;
      color: ${BRAND.accent};
    }
    
    .footer-links a {
      color: ${BRAND.accent};
      text-decoration: none;
      font-weight: 600;
    }
    
    .details-list {
      list-style: none;
      margin: 16px 0;
    }
    
    .details-list li {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid ${BRAND.surfaceBorder};
      font-size: 14px;
    }
    
    .details-list li:last-child {
      border-bottom: none;
    }
    
    .details-list .label {
      color: ${BRAND.textSecondary};
      font-weight: 500;
    }
    
    .details-list .value {
      color: ${BRAND.textPrimary};
      font-weight: 600;
    }
    
    @media (max-width: 480px) {
      .email-wrapper {
        padding: 20px 16px;
      }
      
      .email-body {
        padding: 30px 20px;
      }
      
      .email-header {
        padding: 30px 20px;
      }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="email-header">
        <div class="logo-text">eexams</div>
        <h1>${subject}</h1>
      </div>
      <div class="email-body">
        ${content}
      </div>
      <div class="footer">
        <p class="footer-text">© ${new Date().getFullYear()} eexams. All rights reserved.</p>
        <p class="footer-links">
          <a href="${CLIENT_URL}">Visit eexams</a> | 
          <a href="${CLIENT_URL}/privacy">Privacy Policy</a> | 
          <a href="${CLIENT_URL}/terms">Terms of Service</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
    `,
  };
};

/**
 * Send welcome email to new users
 */
const sendWelcomeEmail = async (user) => {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.log('[EmailService] SENDGRID_API_KEY not configured, welcome email not sent');
      return { success: false, error: 'SendGrid not configured' };
    }

    const content = `
      <p class="greeting">Welcome to eexams, ${user.firstName || 'there'}! 🎉</p>
      
      <p class="message">
        We're excited to have you join our platform. eexams is your gateway to creating, 
        managing, and taking exams with ease. Whether you're a teacher, student, or organization, 
        we've got everything you need to succeed.
      </p>
      
      <div class="info-box">
        <div class="info-box-title">
          <span style="font-size: 18px;">✨</span> What's Next?
        </div>
        <div class="info-box-content">
          <ul style="margin: 0; padding-left: 20px; line-height: 2;">
            <li>Complete your profile setup</li>
            <li>Explore available exams</li>
            <li>Create your first exam (for teachers)</li>
            <li>Join exams and track your progress</li>
          </ul>
        </div>
      </div>
      
      <div style="text-align: center;">
        <a href="${CLIENT_URL}/dashboard" class="cta-button">
          Go to Dashboard →
        </a>
      </div>
      
      <div class="divider"></div>
      
      <p class="message" style="font-size: 13px; text-align: center;">
        Need help getting started? Visit our <a href="${CLIENT_URL}/help" style="color: ${BRAND.accent}; font-weight: 600;">Help Center</a> 
        or contact us at <a href="mailto:support@eexams.com" style="color: ${BRAND.accent}; font-weight: 600;">support@eexams.com</a>
      </p>
    `;

    const email = wrapEmail(content, 'Welcome to eexams!');
    email.to = user.email;

    await sgMail.send(email);
    console.log(`[EmailService] Welcome email sent to ${user.email}`);
    return { success: true };
  } catch (error) {
    console.error('[EmailService] Failed to send welcome email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send account pending approval notification
 */
const sendPendingApprovalEmail = async (user, accountType = 'individual') => {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.log('[EmailService] SENDGRID_API_KEY not configured, pending approval email not sent');
      return { success: false, error: 'SendGrid not configured' };
    }

    const isOrg = accountType === 'organization';
    
    const content = `
      <p class="greeting">Hello ${user.firstName || 'there'},</p>
      
      <p class="message">
        Thank you for registering with eexams! Your ${isOrg ? 'organization' : 'account'} 
        registration has been received and is currently under review.
      </p>
      
      <div style="text-align: center; margin: 24px 0;">
        <span class="status-badge pending">
          <span style="width: 6px; height: 6px; border-radius: 50%; background: currentColor; display: inline-block;"></span>
          Pending Approval
        </span>
      </div>
      
      <div class="info-box">
        <div class="info-box-title">
          <span style="font-size: 18px;">⏱️</span> What happens next?
        </div>
        <div class="info-box-content">
          <ul style="margin: 0; padding-left: 20px; line-height: 2;">
            <li>Our team will review your application within 24-48 hours</li>
            <li>You'll receive an email once your account is approved</li>
            <li>If additional information is needed, we'll contact you</li>
          </ul>
        </div>
      </div>
      
      ${isOrg ? `
      <div class="info-box" style="border-color: ${BRAND.accent}; background: rgba(12, 189, 115, 0.05);">
        <div class="info-box-title" style="color: ${BRAND.accent};">
          <span style="font-size: 18px;">🏢</span> Organization Details
        </div>
        <ul class="details-list">
          <li>
            <span class="label">Organization</span>
            <span class="value">${user.organization || 'N/A'}</span>
          </li>
          <li>
            <span class="label">Plan</span>
            <span class="value" style="text-transform: capitalize;">${user.subscriptionPlan || 'Free'}</span>
          </li>
          <li>
            <span class="label">Status</span>
            <span class="value" style="color: ${BRAND.warning};">Pending Review</span>
          </li>
        </ul>
      </div>
      ` : ''}
      
      <p class="message">
        In the meantime, you can explore our <a href="${CLIENT_URL}/marketplace" style="color: ${BRAND.accent}; font-weight: 600;">Public Exams</a> 
        and familiarize yourself with the platform.
      </p>
      
      <div class="divider"></div>
      
      <p class="message" style="font-size: 13px; text-align: center;">
        Questions? Contact us at <a href="mailto:support@eexams.com" style="color: ${BRAND.accent}; font-weight: 600;">support@eexams.com</a>
      </p>
    `;

    const email = wrapEmail(content, 'Account Registration Pending Approval');
    email.to = user.email;

    await sgMail.send(email);
    console.log(`[EmailService] Pending approval email sent to ${user.email}`);
    return { success: true };
  } catch (error) {
    console.error('[EmailService] Failed to send pending approval email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send account approval confirmation
 */
const sendAccountApprovedEmail = async (user) => {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.log('[EmailService] SENDGRID_API_KEY not configured, approval email not sent');
      return { success: false, error: 'SendGrid not configured' };
    }

    const content = `
      <p class="greeting">Great news, ${user.firstName || 'there'}! 🎉</p>
      
      <p class="message">
        Your eexams account has been approved! You now have full access to all features 
        based on your subscription plan.
      </p>
      
      <div style="text-align: center; margin: 24px 0;">
        <span class="status-badge approved">
          <span style="width: 6px; height: 6px; border-radius: 50%; background: currentColor; display: inline-block;"></span>
          Account Approved
        </span>
      </div>
      
      <div class="info-box" style="border-color: ${BRAND.accent}; background: rgba(12, 189, 115, 0.05);">
        <div class="info-box-title" style="color: ${BRAND.accent};">
          <span style="font-size: 18px;">✅</span> Your Account Details
        </div>
        <ul class="details-list">
          <li>
            <span class="label">Email</span>
            <span class="value">${user.email}</span>
          </li>
          <li>
            <span class="label">Plan</span>
            <span class="value" style="text-transform: capitalize;">${user.subscriptionPlan || 'Free'}</span>
          </li>
          <li>
            <span class="label">Status</span>
            <span class="value" style="color: ${BRAND.success};">Active</span>
          </li>
          ${user.organization ? `
          <li>
            <span class="label">Organization</span>
            <span class="value">${user.organization}</span>
          </li>
          ` : ''}
        </ul>
      </div>
      
      <div style="text-align: center;">
        <a href="${CLIENT_URL}/dashboard" class="cta-button">
          Access Your Dashboard →
        </a>
      </div>
      
      <div class="divider"></div>
      
      <p class="message" style="text-align: center;">
        <strong>What's next?</strong><br>
        Start creating exams, invite students, and track progress!
      </p>
    `;

    const email = wrapEmail(content, 'Your Account Has Been Approved!');
    email.to = user.email;

    await sgMail.send(email);
    console.log(`[EmailService] Account approved email sent to ${user.email}`);
    return { success: true };
  } catch (error) {
    console.error('[EmailService] Failed to send account approved email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send exam approval notification to teacher
 */
const sendExamApprovedEmail = async (user, exam) => {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.log('[EmailService] SENDGRID_API_KEY not configured, exam approval email not sent');
      return { success: false, error: 'SendGrid not configured' };
    }

    const content = `
      <p class="greeting">Hello ${user.firstName || 'there'},</p>
      
      <p class="message">
        Your exam has been approved and is now live! Students can now access and take the exam.
      </p>
      
      <div style="text-align: center; margin: 24px 0;">
        <span class="status-badge approved">
          <span style="width: 6px; height: 6px; border-radius: 50%; background: currentColor; display: inline-block;"></span>
          Exam Approved
        </span>
      </div>
      
      <div class="info-box" style="border-color: ${BRAND.accent}; background: rgba(12, 189, 115, 0.05);">
        <div class="info-box-title" style="color: ${BRAND.accent};">
          <span style="font-size: 18px;">📝</span> Exam Details
        </div>
        <ul class="details-list">
          <li>
            <span class="label">Title</span>
            <span class="value">${exam.title || 'Untitled Exam'}</span>
          </li>
          <li>
            <span class="label">Time Limit</span>
            <span class="value">${exam.timeLimit || 0} minutes</span>
          </li>
          <li>
            <span class="label">Status</span>
            <span class="value" style="color: ${BRAND.success};">Published</span>
          </li>
          ${exam.totalQuestions ? `
          <li>
            <span class="label">Questions</span>
            <span class="value">${exam.totalQuestions}</span>
          </li>
          ` : ''}
        </ul>
      </div>
      
      <div style="text-align: center;">
        <a href="${CLIENT_URL}/teacher/exams/${exam._id}" class="cta-button">
          View Exam →
        </a>
      </div>
      
      <div class="divider"></div>
      
      <p class="message" style="text-align: center;">
        You can track student progress and view results from your dashboard.
      </p>
    `;

    const email = wrapEmail(content, 'Your Exam Has Been Approved!');
    email.to = user.email;

    await sgMail.send(email);
    console.log(`[EmailService] Exam approved email sent to ${user.email}`);
    return { success: true };
  } catch (error) {
    console.error('[EmailService] Failed to send exam approved email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send exam pending approval notification
 */
const sendExamPendingApprovalEmail = async (user, exam) => {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.log('[EmailService] SENDGRID_API_KEY not configured, exam pending email not sent');
      return { success: false, error: 'SendGrid not configured' };
    }

    const content = `
      <p class="greeting">Hello ${user.firstName || 'there'},</p>
      
      <p class="message">
        Your exam has been submitted for review. Our team will review it within 24-48 hours 
        to ensure it meets our quality standards.
      </p>
      
      <div style="text-align: center; margin: 24px 0;">
        <span class="status-badge pending">
          <span style="width: 6px; height: 6px; border-radius: 50%; background: currentColor; display: inline-block;"></span>
          Pending Review
        </span>
      </div>
      
      <div class="info-box">
        <div class="info-box-title">
          <span style="font-size: 18px;">📝</span> Exam Details
        </div>
        <ul class="details-list">
          <li>
            <span class="label">Title</span>
            <span class="value">${exam.title || 'Untitled Exam'}</span>
          </li>
          <li>
            <span class="label">Time Limit</span>
            <span class="value">${exam.timeLimit || 0} minutes</span>
          </li>
          <li>
            <span class="label">Submitted</span>
            <span class="value">${new Date().toLocaleDateString()}</span>
          </li>
        </ul>
      </div>
      
      <div class="info-box">
        <div class="info-box-title">
          <span style="font-size: 18px;">⏱️</span> What happens next?
        </div>
        <div class="info-box-content">
          <ul style="margin: 0; padding-left: 20px; line-height: 2;">
            <li>Our team reviews the exam content</li>
            <li>You'll receive an email once approved</li>
            <li>If changes are needed, we'll provide feedback</li>
            <li>Once approved, students can access the exam</li>
          </ul>
        </div>
      </div>
      
      <div class="divider"></div>
      
      <p class="message" style="text-align: center;">
        You can edit your exam while it's pending review.
      </p>
    `;

    const email = wrapEmail(content, 'Exam Submitted for Review');
    email.to = user.email;

    await sgMail.send(email);
    console.log(`[EmailService] Exam pending approval email sent to ${user.email}`);
    return { success: true };
  } catch (error) {
    console.error('[EmailService] Failed to send exam pending email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send account rejection notification
 */
const sendAccountRejectedEmail = async (user, reason = '') => {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.log('[EmailService] SENDGRID_API_KEY not configured, rejection email not sent');
      return { success: false, error: 'SendGrid not configured' };
    }

    const content = `
      <p class="greeting">Hello ${user.firstName || 'there'},</p>
      
      <p class="message">
        We regret to inform you that your eexams account application could not be approved at this time.
      </p>
      
      <div style="text-align: center; margin: 24px 0;">
        <span class="status-badge rejected">
          <span style="width: 6px; height: 6px; border-radius: 50%; background: currentColor; display: inline-block;"></span>
          Not Approved
        </span>
      </div>
      
      ${reason ? `
      <div class="info-box" style="border-color: ${BRAND.danger}; background: rgba(239, 68, 68, 0.05);">
        <div class="info-box-title" style="color: ${BRAND.danger};">
          <span style="font-size: 18px;">ℹ️</span> Reason
        </div>
        <p class="message" style="margin: 0; color: ${BRAND.textPrimary};">
          ${reason}
        </p>
      </div>
      ` : ''}
      
      <div class="info-box">
        <div class="info-box-title">
          <span style="font-size: 18px;">💡</span> What can you do?
        </div>
        <div class="info-box-content">
          <ul style="margin: 0; padding-left: 20px; line-height: 2;">
            <li>Review your application details</li>
            <li>Ensure all required information is provided</li>
            <li>Contact support for more information</li>
            <li>Reapply with updated information if applicable</li>
          </ul>
        </div>
      </div>
      
      <div class="divider"></div>
      
      <p class="message" style="text-align: center;">
        If you believe this was an error or need more information, please contact us at 
        <a href="mailto:support@eexams.com" style="color: ${BRAND.accent}; font-weight: 600;">support@eexams.com</a>
      </p>
    `;

    const email = wrapEmail(content, 'Account Application Update');
    email.to = user.email;

    await sgMail.send(email);
    console.log(`[EmailService] Account rejection email sent to ${user.email}`);
    return { success: true };
  } catch (error) {
    console.error('[EmailService] Failed to send account rejection email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send password reset confirmation (when password is successfully reset)
 */
const sendPasswordResetConfirmationEmail = async (user) => {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.log('[EmailService] SENDGRID_API_KEY not configured, password reset confirmation not sent');
      return { success: false, error: 'SendGrid not configured' };
    }

    const content = `
      <p class="greeting">Hello ${user.firstName || 'there'},</p>
      
      <p class="message">
        Your password has been successfully reset. You can now log in to your eexams account with your new password.
      </p>
      
      <div style="text-align: center; margin: 24px 0;">
        <span class="status-badge approved">
          <span style="width: 6px; height: 6px; border-radius: 50%; background: currentColor; display: inline-block;"></span>
          Password Updated
        </span>
      </div>
      
      <div class="info-box">
        <div class="info-box-title">
          <span style="font-size: 18px;">🔒</span> Security Tips
        </div>
        <div class="info-box-content">
          <ul style="margin: 0; padding-left: 20px; line-height: 2;">
            <li>Keep your password secure and don't share it</li>
            <li>Use a strong, unique password</li>
            <li>Enable two-factor authentication if available</li>
            <li>Contact us immediately if you didn't request this change</li>
          </ul>
        </div>
      </div>
      
      <div style="text-align: center;">
        <a href="${CLIENT_URL}/login" class="cta-button">
          Log In Now →
        </a>
      </div>
      
      <div class="divider"></div>
      
      <p class="message" style="text-align: center; font-size: 13px; color: ${BRAND.danger};">
        <strong>Didn't reset your password?</strong><br>
        Contact us immediately at <a href="mailto:support@eexams.com" style="color: ${BRAND.accent};">support@eexams.com</a>
      </p>
    `;

    const email = wrapEmail(content, 'Password Reset Successful');
    email.to = user.email;

    await sgMail.send(email);
    console.log(`[EmailService] Password reset confirmation email sent to ${user.email}`);
    return { success: true };
  } catch (error) {
    console.error('[EmailService] Failed to send password reset confirmation:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendWelcomeEmail,
  sendPendingApprovalEmail,
  sendAccountApprovedEmail,
  sendAccountRejectedEmail,
  sendExamApprovedEmail,
  sendExamPendingApprovalEmail,
  sendPasswordResetConfirmationEmail,
  FROM_EMAIL,
  CLIENT_URL,
};
