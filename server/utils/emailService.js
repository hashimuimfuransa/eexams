const sgMail = require('@sendgrid/mail');

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Email configuration
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@eexams.net';
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
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    .email-wrapper {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    
    @media only screen and (max-width: 620px) {
      .email-wrapper {
        padding: 10px;
      }
    }
    
    .email-container {
      background: #FFFFFF;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
    }
    
    .email-header {
      background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.accent} 100%);
      padding: 32px 24px;
      text-align: center;
    }
    
    @media only screen and (max-width: 620px) {
      .email-header {
        padding: 24px 16px;
      }
    }
    
    .email-header .logo {
      max-width: 80px;
      height: auto;
      margin-bottom: 16px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.1);
      padding: 8px;
    }
    
    @media only screen and (max-width: 620px) {
      .email-header .logo {
        max-width: 60px;
        padding: 6px;
      }
    }
    
    .email-header h1 {
      color: #FFFFFF;
      font-size: 22px;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.02em;
    }
    
    @media only screen and (max-width: 620px) {
      .email-header h1 {
        font-size: 18px;
      }
    }
    
    .email-body {
      padding: 32px 24px;
    }
    
    @media only screen and (max-width: 620px) {
      .email-body {
        padding: 24px 16px;
      }
    }
    
    .greeting {
      font-size: 18px;
      font-weight: 600;
      color: ${BRAND.textPrimary};
      margin-bottom: 12px;
    }
    
    @media only screen and (max-width: 620px) {
      .greeting {
        font-size: 16px;
      }
    }
    
    .message {
      font-size: 15px;
      color: ${BRAND.textSecondary};
      margin-bottom: 20px;
      line-height: 1.7;
    }
    
    @media only screen and (max-width: 620px) {
      .message {
        font-size: 14px;
      }
    }
    
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.accent} 100%);
      color: #FFFFFF !important;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 15px;
      box-shadow: 0 4px 16px rgba(12, 189, 115, 0.3);
      margin: 12px 0;
    }
    
    .cta-button:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(12, 189, 115, 0.4);
    }
    
    @media only screen and (max-width: 620px) {
      .cta-button {
        display: block;
        width: 100%;
        text-align: center;
        padding: 12px 20px;
        font-size: 14px;
      }
    }
    
    .info-box {
      background: ${BRAND.surfaceAlt};
      border: 1px solid ${BRAND.surfaceBorder};
      border-radius: 12px;
      padding: 18px;
      margin: 20px 0;
    }
    
    @media only screen and (max-width: 620px) {
      .info-box {
        padding: 14px;
      }
    }
    
    .info-box-title {
      font-size: 14px;
      font-weight: 700;
      color: ${BRAND.textPrimary};
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    @media only screen and (max-width: 620px) {
      .info-box-title {
        font-size: 13px;
      }
    }
    
    .info-box-content {
      font-size: 14px;
      color: ${BRAND.textSecondary};
    }
    
    @media only screen and (max-width: 620px) {
      .info-box-content {
        font-size: 13px;
      }
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
      margin: 20px 0;
    }
    
    .footer {
      padding: 24px;
      text-align: center;
      background: ${BRAND.surfaceAlt};
    }
    
    @media only screen and (max-width: 620px) {
      .footer {
        padding: 16px;
      }
    }
    
    .footer-text {
      font-size: 13px;
      color: ${BRAND.textSecondary};
      margin-bottom: 8px;
    }
    
    @media only screen and (max-width: 620px) {
      .footer-text {
        font-size: 12px;
      }
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
      margin: 12px 0;
    }
    
    .details-list li {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid ${BRAND.surfaceBorder};
      font-size: 14px;
    }
    
    @media only screen and (max-width: 620px) {
      .details-list li {
        font-size: 13px;
        padding: 8px 0;
      }
    }
    
    .details-list li:last-child {
      border-bottom: none;
    }
    
    .details-list .label {
      font-weight: 600;
      color: ${BRAND.textSecondary};
    }
    
    .details-list .value {
      font-weight: 600;
      color: ${BRAND.textPrimary};
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="email-header">
        <img src="${CLIENT_URL}/logo.png" alt="eexams Logo" class="logo" onerror="this.style.display='none'">
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

      <div class="info-box" style="border-color: ${BRAND.accent}; background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);">
        <div class="info-box-title" style="color: ${BRAND.primary};">
          <span style="font-size: 18px;">📱</span> Download Our Mobile App
        </div>
        <div class="info-box-content">
          <p style="margin: 0 0 12px 0; line-height: 1.6;">
            Get the Excellence Coaching Hub app to access detailed explanations, practice questions, and personalized learning paths to help you master topics you're struggling with.
          </p>
          <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin-top: 16px;">
            <a href="https://play.google.com/store/apps/details?id=com.excellencecoachinghub.app&pcampaignid=web_share" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 8px; background: #FFFFFF; color: ${BRAND.primary}; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.3,13.1L18.06,14.37L15.5,11.81L18.06,9.25L20.3,10.5C20.93,10.86 20.93,11.73 20.3,13.1M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
              </svg>
              Google Play
            </a>
            <a href="https://apps.microsoft.com/detail/9NW5V60BNHNN?hl=en-us&gl=US&ocid=pdpshare" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 8px; background: #FFFFFF; color: ${BRAND.primary}; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M1,1H11V11H1V1M13,1H23V11H13V1M1,13H11V23H1V13M13,13H23V23H13V13Z" />
              </svg>
              Microsoft Store
            </a>
          </div>
        </div>
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

/**
 * Send welcome email to newly created student with their credentials
 */
const sendStudentWelcomeEmail = async (student, password) => {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.log('[EmailService] SENDGRID_API_KEY not configured, student welcome email not sent');
      return { success: false, error: 'SendGrid not configured' };
    }

    const content = `
      <p class="greeting">Hello ${student.firstName || 'there'},</p>
      
      <p class="message">
        Your teacher has created an account for you on eexams. You can now log in and take exams assigned to you.
      </p>
      
      <div class="info-box" style="border-color: ${BRAND.accent}; background: rgba(12, 189, 115, 0.05);">
        <div class="info-box-title" style="color: ${BRAND.accent};">
          <span style="font-size: 18px;">🔐</span> Your Login Credentials
        </div>
        <ul class="details-list">
          <li>
            <span class="label">Email</span>
            <span class="value">${student.email}</span>
          </li>
          <li>
            <span class="label">Default Password</span>
            <span class="value" style="color: ${BRAND.accent}; font-family: monospace; font-size: 16px;">${password}</span>
          </li>
        </ul>
      </div>
      
      <div class="info-box">
        <div class="info-box-title">
          <span style="font-size: 18px;">⚠️</span> Important
        </div>
        <div class="info-box-content">
          <p style="margin: 0; line-height: 1.6;">
            Please log in and change your password as soon as possible for security.
          </p>
        </div>
      </div>
      
      <div style="text-align: center;">
        <a href="${CLIENT_URL}/login" class="cta-button">
          Log In Now →
        </a>
      </div>
      
      <div class="divider"></div>
      
      <p class="message" style="font-size: 13px; text-align: center;">
        If you have any trouble logging in, contact your teacher or email 
        <a href="mailto:support@eexams.com" style="color: ${BRAND.accent}; font-weight: 600;">support@eexams.com</a>
      </p>
    `;

    const email = wrapEmail(content, 'Your eexams Account Has Been Created');
    email.to = student.email;

    await sgMail.send(email);
    console.log(`[EmailService] Student welcome email sent to ${student.email}`);
    return { success: true };
  } catch (error) {
    console.error('[EmailService] Failed to send student welcome email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send welcome email to teacher when their account is created
 */
const sendTeacherWelcomeEmail = async (teacher, password, organization) => {
  try {
    console.log('[EmailService] Attempting to send teacher welcome email to:', teacher.email);
    console.log('[EmailService] SENDGRID_API_KEY configured:', !!process.env.SENDGRID_API_KEY);
    console.log('[EmailService] FROM_EMAIL:', process.env.SENDGRID_FROM_EMAIL);
    
    if (!process.env.SENDGRID_API_KEY) {
      console.log('[EmailService] SENDGRID_API_KEY not configured, teacher welcome email not sent');
      return { success: false, error: 'SendGrid not configured' };
    }

    const content = `
      <p class="greeting">Hello ${teacher.firstName || 'there'},</p>
      
      <p class="message">
        You have been added as a teacher to ${organization || 'eexams'}. Your account has been created and you can now log in to start creating exams and managing students.
      </p>
      
      <div class="info-box" style="border-color: ${BRAND.accent}; background: rgba(12, 189, 115, 0.05);">
        <div class="info-box-title" style="color: ${BRAND.accent};">
          <span style="font-size: 18px;">🔐</span> Your Login Credentials
        </div>
        <ul class="details-list">
          <li>
            <span class="label">Email</span>
            <span class="value">${teacher.email}</span>
          </li>
          <li>
            <span class="label">Password</span>
            <span class="value" style="color: ${BRAND.accent}; font-family: monospace; font-size: 16px;">${password}</span>
          </li>
        </ul>
      </div>
      
      <div class="info-box">
        <div class="info-box-title">
          <span style="font-size: 18px;">📚</span> What You Can Do
        </div>
        <div class="info-box-content">
          <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
            <li>Create and manage exams</li>
            <li>Add and manage students</li>
            <li>View exam results and analytics</li>
            <li>Share exams with other teachers</li>
          </ul>
        </div>
      </div>
      
      <div class="info-box">
        <div class="info-box-title">
          <span style="font-size: 18px;">⚠️</span> Important
        </div>
        <div class="info-box-content">
          <p style="margin: 0; line-height: 1.6;">
            Please log in and change your password as soon as possible for security.
          </p>
        </div>
      </div>
      
      <div style="text-align: center;">
        <a href="${CLIENT_URL}/login" class="cta-button">
          Log In Now →
        </a>
      </div>
      
      <div class="divider"></div>
      
      <p class="footer-text">
        If you have any trouble logging in, please contact your organization administrator.
      </p>
    `;

    const email = wrapEmail(content, `Welcome to ${organization || 'eexams'} - Your Teacher Account`);
    email.to = teacher.email;

    await sgMail.send(email);
    console.log(`[EmailService] Teacher welcome email sent to ${teacher.email}`);
    return { success: true };
  } catch (error) {
    console.error('[EmailService] Teacher welcome email error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send update notification to teacher when their account is updated
 */
const sendTeacherUpdateEmail = async (teacher, changes, organization) => {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.log('[EmailService] SENDGRID_API_KEY not configured, teacher update email not sent');
      return { success: false, error: 'SendGrid not configured' };
    }

    const changesList = Object.entries(changes)
      .map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`)
      .join('');

    const content = `
      <p class="greeting">Hello ${teacher.firstName || 'there'},</p>
      
      <p class="message">
        Your teacher account at ${organization || 'eexams'} has been updated.
      </p>
      
      <div class="info-box">
        <div class="info-box-title">
          <span style="font-size: 18px;">📝</span> Changes Made
        </div>
        <div class="info-box-content">
          <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
            ${changesList}
          </ul>
        </div>
      </div>
      
      <div class="info-box">
        <div class="info-box-title">
          <span style="font-size: 18px;">ℹ️</span> Information
        </div>
        <div class="info-box-content">
          <p style="margin: 0; line-height: 1.6;">
            If you did not request these changes or have any questions, please contact your organization administrator.
          </p>
        </div>
      </div>
      
      <div style="text-align: center;">
        <a href="${CLIENT_URL}/login" class="cta-button">
          Log In to Your Account →
        </a>
      </div>
      
      <div class="divider"></div>
      
      <p class="footer-text">
        If you have any questions, please contact your organization administrator.
      </p>
    `;

    const email = wrapEmail(content, `Your Teacher Account at ${organization || 'eexams'} Has Been Updated`);
    email.to = teacher.email;

    await sgMail.send(email);
    console.log(`[EmailService] Teacher update email sent to ${teacher.email}`);
    return { success: true };
  } catch (error) {
    console.error('[EmailService] Teacher update email error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send update notification to student when their account is updated
 */
const sendStudentUpdateEmail = async (student, changes) => {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.log('[EmailService] SENDGRID_API_KEY not configured, student update email not sent');
      return { success: false, error: 'SendGrid not configured' };
    }

    const changesList = Object.entries(changes)
      .map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`)
      .join('');

    const content = `
      <p class="greeting">Hello ${student.firstName || 'there'},</p>
      
      <p class="message">
        Your eexams account has been updated.
      </p>
      
      <div class="info-box">
        <div class="info-box-title">
          <span style="font-size: 18px;">📝</span> Changes Made
        </div>
        <div class="info-box-content">
          <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
            ${changesList}
          </ul>
        </div>
      </div>
      
      <div class="info-box">
        <div class="info-box-title">
          <span style="font-size: 18px;">ℹ️</span> Information
        </div>
        <div class="info-box-content">
          <p style="margin: 0; line-height: 1.6;">
            If you did not request these changes or have any questions, please contact your teacher or organization administrator.
          </p>
        </div>
      </div>
      
      <div style="text-align: center;">
        <a href="${CLIENT_URL}/login" class="cta-button">
          Log In to Your Account →
        </a>
      </div>
      
      <div class="divider"></div>
      
      <p class="footer-text">
        If you have any questions, please contact your teacher or organization administrator.
      </p>
    `;

    const email = wrapEmail(content, 'Your eexams Account Has Been Updated');
    email.to = student.email;

    await sgMail.send(email);
    console.log(`[EmailService] Student update email sent to ${student.email}`);
    return { success: true };
  } catch (error) {
    console.error('[EmailService] Student update email error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send contact form submission email to admin
 */
const sendContactEmail = async (contactData) => {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.log('[EmailService] SENDGRID_API_KEY not configured, contact email not sent');
      return { success: false, error: 'SendGrid not configured' };
    }

    const { name, email: senderEmail, subject, message } = contactData;

    const content = `
      <p class="greeting">New Contact Form Submission</p>
      
      <p class="message">
        You have received a new message from the contact form on eexams.
      </p>
      
      <div class="info-box" style="border-color: ${BRAND.accent}; background: rgba(12, 189, 115, 0.05);">
        <div class="info-box-title" style="color: ${BRAND.accent};">
          <span style="font-size: 18px;">📧</span> Contact Information
        </div>
        <ul class="details-list">
          <li>
            <span class="label">Name</span>
            <span class="value">${name || 'Not provided'}</span>
          </li>
          <li>
            <span class="label">Email</span>
            <span class="value">${senderEmail || 'Not provided'}</span>
          </li>
          <li>
            <span class="label">Subject</span>
            <span class="value">${subject || 'No subject'}</span>
          </li>
        </ul>
      </div>
      
      <div class="info-box">
        <div class="info-box-title">
          <span style="font-size: 18px;">💬</span> Message
        </div>
        <p class="message" style="margin: 0; white-space: pre-wrap; line-height: 1.6;">
          ${message || 'No message provided'}
        </p>
      </div>
      
      <div class="divider"></div>
      
      <p class="message" style="font-size: 13px; text-align: center;">
        This message was sent from the eexams contact form at ${new Date().toLocaleString()}
      </p>
    `;

    const email = wrapEmail(content, `Contact Form: ${subject || 'New Message'}`);
    email.to = process.env.CONTACT_EMAIL || 'info@excellencecoachinghub.com';
    email.replyTo = senderEmail;

    await sgMail.send(email);
    console.log(`[EmailService] Contact email sent from ${senderEmail}`);
    return { success: true };
  } catch (error) {
    console.error('[EmailService] Failed to send contact email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send password reset notification to student when teacher resets their password
 */
const sendStudentPasswordResetEmail = async (student, newPassword) => {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.log('[EmailService] SENDGRID_API_KEY not configured, student password reset email not sent');
      return { success: false, error: 'SendGrid not configured' };
    }

    const content = `
      <p class="greeting">Hello ${student.firstName || 'there'},</p>
      
      <p class="message">
        Your teacher has reset your eexams password. You can log in with your new password below.
      </p>
      
      <div class="info-box" style="border-color: ${BRAND.accent}; background: rgba(12, 189, 115, 0.05);">
        <div class="info-box-title" style="color: ${BRAND.accent};">
          <span style="font-size: 18px;">🔐</span> Your New Password
        </div>
        <ul class="details-list">
          <li>
            <span class="label">Email</span>
            <span class="value">${student.email}</span>
          </li>
          <li>
            <span class="label">New Password</span>
            <span class="value" style="color: ${BRAND.accent}; font-family: monospace; font-size: 16px;">${newPassword}</span>
          </li>
        </ul>
      </div>
      
      <div class="info-box">
        <div class="info-box-title">
          <span style="font-size: 18px;">⚠️</span> Important
        </div>
        <div class="info-box-content">
          <p style="margin: 0; line-height: 1.6;">
            Please log in and change your password as soon as possible for security.
          </p>
        </div>
      </div>
      
      <div style="text-align: center;">
        <a href="${CLIENT_URL}/login" class="cta-button">
          Log In Now →
        </a>
      </div>
      
      <div class="divider"></div>
      
      <p class="message" style="font-size: 13px; text-align: center;">
        If you did not request this password reset, please contact your teacher or email 
        <a href="mailto:support@eexams.com" style="color: ${BRAND.accent}; font-weight: 600;">support@eexams.com</a>
      </p>
    `;

    const email = wrapEmail(content, 'Your Password Has Been Reset');
    email.to = student.email;

    await sgMail.send(email);
    console.log(`[EmailService] Student password reset email sent to ${student.email}`);
    return { success: true };
  } catch (error) {
    console.error('[EmailService] Failed to send student password reset email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send exam approval notification to student
 */
const sendStudentExamApprovedEmail = async (student, exam, shareToken, password = null) => {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.log('[EmailService] SENDGRID_API_KEY not configured, student exam approval email not sent');
      return { success: false, error: 'SendGrid not configured' };
    }

    let loginCredentialsSection = '';
    if (password) {
      loginCredentialsSection = `
      <div class="info-box" style="border-color: ${BRAND.warning}; background: rgba(251, 191, 36, 0.05);">
        <div class="info-box-title" style="color: ${BRAND.warning};">
          <span style="font-size: 18px;">🔐</span> Your Login Credentials
        </div>
        <ul class="details-list">
          <li>
            <span class="label">Email</span>
            <span class="value">${student.email}</span>
          </li>
          <li>
            <span class="label">Password</span>
            <span class="value" style="color: ${BRAND.warning}; font-family: monospace; font-size: 16px;">${password}</span>
          </li>
        </ul>
        <p style="margin: 12px 0 0 0; font-size: 13px; color: #666;">
          Please log in and change your password as soon as possible for security.
        </p>
      </div>

      <div class="divider"></div>
      `;
    }

    const content = `
      <p class="greeting">Great news, ${student.firstName || 'there'}! 🎉</p>

      <p class="message">
        Your exam request has been approved! You can now take the exam and track your progress.
      </p>

      <div style="text-align: center; margin: 24px 0;">
        <span class="status-badge approved">
          <span style="width: 6px; height: 6px; border-radius: 50%; background: currentColor; display: inline-block;"></span>
          Exam Approved
        </span>
      </div>

      ${loginCredentialsSection}

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
            <span class="value" style="color: ${BRAND.success};">Ready to Start</span>
          </li>
        </ul>
      </div>

      <div style="text-align: center;">
        <a href="${CLIENT_URL}/student/exam/${exam._id}" class="cta-button">
          Start Exam Now →
        </a>
      </div>

      <div class="divider"></div>

      <div class="info-box" style="border-color: ${BRAND.accent}; background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);">
        <div class="info-box-title" style="color: ${BRAND.primary};">
          <span style="font-size: 18px;">📱</span> Download Our Mobile App
        </div>
        <div class="info-box-content">
          <p style="margin: 0 0 12px 0; line-height: 1.6;">
            Get the Excellence Coaching Hub app to access detailed explanations, practice questions, and personalized learning paths to help you master topics you're struggling with.
          </p>
          <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin-top: 16px;">
            <a href="https://play.google.com/store/apps/details?id=com.excellencecoachinghub.app&pcampaignid=web_share" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 8px; background: #FFFFFF; color: ${BRAND.primary}; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.3,13.1L18.06,14.37L15.5,11.81L18.06,9.25L20.3,10.5C20.93,10.86 20.93,11.73 20.3,13.1M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
              </svg>
              Google Play
            </a>
            <a href="https://apps.microsoft.com/detail/9NW5V60BNHNN?hl=en-us&gl=US&ocid=pdpshare" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 8px; background: #FFFFFF; color: ${BRAND.primary}; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M1,1H11V11H1V1M13,1H23V11H13V1M1,13H11V23H1V13M13,13H23V23H13V13Z" />
              </svg>
              Microsoft Store
            </a>
          </div>
        </div>
      </div>
    `;

    const email = wrapEmail(content, 'Your Exam Request Has Been Approved!');
    email.to = student.email;

    await sgMail.send(email);
    console.log(`[EmailService] Student exam approval email sent to ${student.email}`);
    return { success: true };
  } catch (error) {
    console.error('[EmailService] Failed to send student exam approval email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send grades notification to student with app recommendation
 */
const sendStudentGradesEmail = async (student, result, exam) => {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.log('[EmailService] SENDGRID_API_KEY not configured, student grades email not sent');
      return { success: false, error: 'SendGrid not configured' };
    }

    const percentage = Math.round((result.totalScore / result.maxPossibleScore) * 100);
    const grade = percentage >= 80 ? 'A' : percentage >= 70 ? 'B' : percentage >= 60 ? 'C' : percentage >= 50 ? 'D' : 'F';

    const content = `
      <p class="greeting">Hello ${student.firstName || 'there'},</p>

      <p class="message">
        Your exam results are now available! You can view your detailed performance and feedback.
      </p>

      <div style="text-align: center; margin: 24px 0;">
        <span class="status-badge ${percentage >= 70 ? 'approved' : 'pending'}">
          <span style="width: 6px; height: 6px; border-radius: 50%; background: currentColor; display: inline-block;"></span>
          Grade: ${grade} (${percentage}%)
        </span>
      </div>

      <div class="info-box" style="border-color: ${BRAND.accent}; background: rgba(12, 189, 115, 0.05);">
        <div class="info-box-title" style="color: ${BRAND.accent};">
          <span style="font-size: 18px;">📊</span> Exam Results
        </div>
        <ul class="details-list">
          <li>
            <span class="label">Exam</span>
            <span class="value">${exam.title || 'Untitled Exam'}</span>
          </li>
          <li>
            <span class="label">Your Score</span>
            <span class="value">${result.totalScore} / ${result.maxPossibleScore}</span>
          </li>
          <li>
            <span class="label">Percentage</span>
            <span class="value">${percentage}%</span>
          </li>
          <li>
            <span class="label">Grade</span>
            <span class="value" style="color: ${percentage >= 70 ? BRAND.success : BRAND.warning};">${grade}</span>
          </li>
        </ul>
      </div>

      <div style="text-align: center;">
        <a href="${CLIENT_URL}/student/results/${result._id}" class="cta-button">
          View Detailed Results →
        </a>
      </div>

      <div class="divider"></div>

      <div class="info-box" style="border-color: ${BRAND.accent}; background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);">
        <div class="info-box-title" style="color: ${BRAND.primary};">
          <span style="font-size: 18px;">📱</span> Improve Your Learning
        </div>
        <div class="info-box-content">
          <p style="margin: 0 0 12px 0; line-height: 1.6;">
            ${percentage < 70 ? 'Struggling with some topics?' : 'Want to improve your scores even more?'} Get the Excellence Coaching Hub app to access detailed explanations, practice questions, and personalized learning paths.
          </p>
          <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin-top: 16px;">
            <a href="https://play.google.com/store/apps/details?id=com.excellencecoachinghub.app&pcampaignid=web_share" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 8px; background: #FFFFFF; color: ${BRAND.primary}; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.3,13.1L18.06,14.37L15.5,11.81L18.06,9.25L20.3,10.5C20.93,10.86 20.93,11.73 20.3,13.1M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
              </svg>
              Google Play
            </a>
            <a href="https://apps.microsoft.com/detail/9NW5V60BNHNN?hl=en-us&gl=US&ocid=pdpshare" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 8px; background: #FFFFFF; color: ${BRAND.primary}; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M1,1H11V11H1V1M13,1H23V11H13V1M1,13H11V23H1V13M13,13H23V23H13V13Z" />
              </svg>
              Microsoft Store
            </a>
          </div>
        </div>
      </div>
    `;

    const email = wrapEmail(content, `Your Exam Results: ${exam.title || 'Exam'}`);
    email.to = student.email;

    await sgMail.send(email);
    console.log(`[EmailService] Student grades email sent to ${student.email}`);
    return { success: true };
  } catch (error) {
    console.error('[EmailService] Failed to send student grades email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send email notification to all super admins about a new pending exam request
 */
const sendSuperAdminPendingRequestEmail = async (examRequest, exam, studentInfo) => {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.log('[EmailService] SENDGRID_API_KEY not configured, super admin notification not sent');
      return { success: false };
    }

    const User = require('../models/User');
    
    // Get all super admins
    const superAdmins = await User.find({ role: 'superadmin' }).select('email firstName lastName');
    
    if (superAdmins.length === 0) {
      console.log('[EmailService] No super admins found to notify');
      return { success: false };
    }

    const superAdminEmails = superAdmins.map(sa => sa.email);
    
    const content = `
      <div style="font-family: 'DM Sans', sans-serif; max-width: 600px; margin: 0 auto; background: #f5fbf8; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #0D406C 0%, #0CBD73 100%); padding: 40px 30px; text-align: center;">
          <h1 style="color: white; font-size: 28px; font-weight: 700; margin: 0;">🔔 New Exam Request Pending</h1>
          <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 10px 0 0 0;">Action Required</p>
        </div>
        
        <div style="padding: 40px 30px;">
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            A new exam request has been submitted and requires your approval.
          </p>
          
          <div style="background: white; border-radius: 8px; padding: 25px; margin-bottom: 25px; border: 1px solid #D7E5DD;">
            <h3 style="color: #0D406C; font-size: 18px; font-weight: 700; margin: 0 0 15px 0;">Request Details</h3>
            
            <div style="margin-bottom: 15px;">
              <p style="color: #64748B; font-size: 14px; margin: 0 0 5px 0; font-weight: 600;">Student Name</p>
              <p style="color: #0F172A; font-size: 16px; margin: 0;">${studentInfo.name}</p>
            </div>
            
            <div style="margin-bottom: 15px;">
              <p style="color: #64748B; font-size: 14px; margin: 0 0 5px 0; font-weight: 600;">Student Email</p>
              <p style="color: #0F172A; font-size: 16px; margin: 0;">${studentInfo.email}</p>
            </div>
            
            <div style="margin-bottom: 15px;">
              <p style="color: #64748B; font-size: 14px; margin: 0 0 5px 0; font-weight: 600;">Exam Title</p>
              <p style="color: #0F172A; font-size: 16px; margin: 0;">${exam.title}</p>
            </div>
            
            <div style="margin-bottom: 15px;">
              <p style="color: #64748B; font-size: 14px; margin: 0 0 5px 0; font-weight: 600;">Price</p>
              <p style="color: #0F172A; font-size: 16px; margin: 0;">${exam.publicPrice > 0 ? `RWF ${exam.publicPrice.toLocaleString()}` : 'Free'}</p>
            </div>
            
            <div>
              <p style="color: #64748B; font-size: 14px; margin: 0 0 5px 0; font-weight: 600;">Request ID</p>
              <p style="color: #0F172A; font-size: 14px; margin: 0; font-family: monospace;">${examRequest._id}</p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${CLIENT_URL}/superadmin" style="display: inline-block; background: linear-gradient(135deg, #0D406C 0%, #0CBD73 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px;">
              Review Request in Admin Panel
            </a>
          </div>
          
          <p style="color: #64748B; font-size: 14px; text-align: center; margin-top: 25px;">
            This is an automated notification. Please do not reply to this email.
          </p>
        </div>
        
        <div style="background: #0D406C; padding: 20px; text-align: center;">
          <p style="color: rgba(255,255,255,0.8); font-size: 14px; margin: 0;">© 2026 TestFy Rwanda. All rights reserved.</p>
        </div>
      </div>
    `;

    const emailWrapper = wrapEmail(content, '🔔 New Exam Request Pending - Action Required');
    
    // Send to all super admins
    const emails = superAdminEmails.map(email => ({
      ...emailWrapper,
      to: email
    }));

    await sgMail.sendMultiple(emails);
    console.log(`[EmailService] Super admin notification sent to ${superAdminEmails.length} super admins`);
    return { success: true };
  } catch (error) {
    console.error('[EmailService] Failed to send super admin notification:', error);
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
  sendStudentWelcomeEmail,
  sendStudentPasswordResetEmail,
  sendStudentUpdateEmail,
  sendTeacherWelcomeEmail,
  sendTeacherUpdateEmail,
  sendContactEmail,
  sendStudentExamApprovedEmail,
  sendStudentGradesEmail,
  sendSuperAdminPendingRequestEmail,
  FROM_EMAIL,
  CLIENT_URL,
};
