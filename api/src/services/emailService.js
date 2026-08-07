import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Verify connection configuration on startup
transporter.verify()
  .then(() => console.log('[EmailService] SMTP Connection established successfully'))
  .catch(err => console.warn('[EmailService] SMTP Verification warning:', err.message));

/**
 * Sends a professional email notification when an official's registration/application is APPROVED.
 */
export async function sendOfficialApprovalEmail({ email, firstName, lastName, positionTitle, office, tloId }) {
  if (!email) {
    console.warn('[EmailService] Cannot send approval email: No recipient email provided.');
    return false;
  }

  const recipientName = [firstName, lastName].filter(Boolean).join(' ') || 'Official';
  const displayPosition = positionTitle || 'Third Level Official';
  const displayOffice = office || 'Department of Education';

  const mailOptions = {
    from: `"Department of Education — InsightEd" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `[DepEd InsightEd] Official Profile Registration Approved — ${recipientName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; background-color: #f4f7fa; margin: 0; padding: 20px; color: #1e293b; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
          .header { background: #08315F; padding: 32px 24px; text-align: center; border-bottom: 4px solid #FCD116; }
          .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; text-transform: uppercase; }
          .header p { color: #94a3b8; margin: 6px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; }
          .content { padding: 32px 28px; }
          .badge { display: inline-block; background: #ecfdf5; color: #047857; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; padding: 6px 16px; border-radius: 9999px; border: 1px solid #a7f3d0; margin-bottom: 20px; }
          .title { font-size: 20px; font-weight: 800; color: #08315F; margin: 0 0 12px 0; }
          .text { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px 0; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
          .card-row { display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding: 8px 0; }
          .card-row:last-child { border-bottom: none; }
          .card-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
          .card-value { font-size: 13px; font-weight: 700; color: #08315F; text-align: right; }
          .footer { background: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Department of Education</h1>
            <p>InsightEd Executive Leadership Portal</p>
          </div>
          <div class="content">
            <div class="badge">✓ Registration Approved</div>
            <h2 class="title">Official Profile Approved</h2>
            <p class="text">
              Dear <strong>${recipientName}</strong>,<br><br>
              We are pleased to inform you that your official profile registration has been <strong>approved</strong> by the Personnel Division. Your profile records are now active in the official masterlist registry.
            </p>

            <div class="card">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #f1f5f9;">Official Name</td>
                  <td style="padding: 8px 0; font-size: 13px; font-weight: 700; color: #08315F; text-align: right; border-bottom: 1px solid #f1f5f9;">${recipientName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #f1f5f9;">Position Title</td>
                  <td style="padding: 8px 0; font-size: 13px; font-weight: 700; color: #08315F; text-align: right; border-bottom: 1px solid #f1f5f9;">${displayPosition}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #f1f5f9;">Office / Division</td>
                  <td style="padding: 8px 0; font-size: 13px; font-weight: 700; color: #08315F; text-align: right; border-bottom: 1px solid #f1f5f9;">${displayOffice}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Status</td>
                  <td style="padding: 8px 0; font-size: 13px; font-weight: 700; color: #047857; text-align: right;">Active / Approved</td>
                </tr>
              </table>
            </div>

            <p class="text">
              You may now log in to the <strong>InsightEd Portal</strong> to access your complete profiling records and manage official personnel information.
            </p>
          </div>
          <div class="footer">
            © 2026 Department of Education • InsightEd Nexus Executive Portal<br>
            Strictly for Personnel Division Administrative Notifications
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] Approval notification sent successfully to ${email} (MessageID: ${info.messageId})`);
    return true;
  } catch (err) {
    console.error(`[EmailService] Failed to send approval email to ${email}:`, err.message);
    return false;
  }
}

/**
 * Sends a professional email notification when an official's registration/application is REJECTED.
 */
export async function sendOfficialRejectionEmail({ email, firstName, lastName, positionTitle, office, reason }) {
  if (!email) {
    console.warn('[EmailService] Cannot send rejection email: No recipient email provided.');
    return false;
  }

  const recipientName = [firstName, lastName].filter(Boolean).join(' ') || 'Official';
  const displayPosition = positionTitle || 'Third Level Official';
  const displayOffice = office || 'Department of Education';
  const denialReason = (reason && reason.trim()) ? reason.trim() : 'Registration details require administrative verification.';

  const mailOptions = {
    from: `"Department of Education — InsightEd" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `[DepEd InsightEd] Official Profile Registration Status Update — ${recipientName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; background-color: #f4f7fa; margin: 0; padding: 20px; color: #1e293b; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
          .header { background: #08315F; padding: 32px 24px; text-align: center; border-bottom: 4px solid #ef4444; }
          .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; text-transform: uppercase; }
          .header p { color: #94a3b8; margin: 6px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; }
          .content { padding: 32px 28px; }
          .badge { display: inline-block; background: #fef2f2; color: #dc2626; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; padding: 6px 16px; border-radius: 9999px; border: 1px solid #fecaca; margin-bottom: 20px; }
          .title { font-size: 20px; font-weight: 800; color: #08315F; margin: 0 0 12px 0; }
          .text { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px 0; }
          .reason-box { background: #fff1f2; border-left: 4px solid #f43f5e; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; }
          .reason-title { font-size: 11px; font-weight: 800; color: #be123c; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
          .reason-text { font-size: 13px; font-weight: 600; color: #881337; margin: 0; line-height: 1.5; }
          .footer { background: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Department of Education</h1>
            <p>InsightEd Executive Leadership Portal</p>
          </div>
          <div class="content">
            <div class="badge">✕ Status Update — Rejected</div>
            <h2 class="title">Registration Application Notice</h2>
            <p class="text">
              Dear <strong>${recipientName}</strong>,<br><br>
              We are writing to inform you regarding your profile registration for <strong>${displayPosition}</strong> at <strong>${displayOffice}</strong>. After administrative evaluation by the Personnel Division, your registration status has been updated to <strong>Rejected</strong>.
            </p>

            <div class="reason-box">
              <div class="reason-title">Remarks / Reason for Rejection</div>
              <p class="reason-text">${denialReason}</p>
            </div>

            <p class="text">
              If you require further clarification or need to resubmit supporting documentation, please coordinate directly with your Regional Personnel Division or System Administrator.
            </p>
          </div>
          <div class="footer">
            © 2026 Department of Education • InsightEd Nexus Executive Portal<br>
            Strictly for Personnel Division Administrative Notifications
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] Rejection notification sent successfully to ${email} (MessageID: ${info.messageId})`);
    return true;
  } catch (err) {
    console.error(`[EmailService] Failed to send rejection email to ${email}:`, err.message);
    return false;
  }
}
