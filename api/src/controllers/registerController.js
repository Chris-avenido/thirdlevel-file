import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import pool from '../config/db.js';

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

transporter.verify().then(() => console.log('SMTP connection verified')).catch(err => console.warn('SMTP verification failed:', err.message));

const sendOTPEmail = async (email, code) => {
  const mailOptions = {
    from: `"InsightEd Support" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Verification Code - InsightEd',
    html: `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #004A99;">Verify Your Email</h2>
        <p>Your verification code is:</p>
        <div style="background: #f4f4f4; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center; border-radius: 10px;">
          ${code}
        </div>
        <p style="margin-top: 20px; font-size: 12px; color: #666;">This code will expire in 10 minutes.</p>
      </div>
    `
  };
  return transporter.sendMail(mailOptions);
};

// ── OTP email verification helpers ──
// Codes live in `verification_codes` (email PK, code, expires_at) and are valid for 10 minutes.
// Failed attempts are tracked in memory; after OTP_MAX_ATTEMPTS the code is invalidated
// (expires_at = NOW()) so a new one must be requested. Codes are never deleted, only expired.
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const otpFailedAttempts = new Map();

const checkOtpCode = async (cleanEmail, code) => {
  const cleanCode = String(code || '').trim();
  if (!/^\d{6}$/.test(cleanCode)) {
    return { valid: false, error: 'Invalid or expired code' };
  }

  const result = await pool.query(
    `SELECT 1 FROM verification_codes WHERE email = $1 AND code = $2 AND expires_at > NOW()`,
    [cleanEmail, cleanCode]
  );

  if (result.rows.length === 0) {
    const attempts = (otpFailedAttempts.get(cleanEmail) || 0) + 1;
    if (attempts >= OTP_MAX_ATTEMPTS) {
      otpFailedAttempts.delete(cleanEmail);
      await pool.query(`UPDATE verification_codes SET expires_at = NOW() WHERE email = $1`, [cleanEmail]);
      return { valid: false, error: 'Too many incorrect attempts. Please request a new code.' };
    }
    otpFailedAttempts.set(cleanEmail, attempts);
    return { valid: false, error: 'Invalid or expired code' };
  }

  otpFailedAttempts.delete(cleanEmail);
  return { valid: true };
};

export const sendOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const cleanEmail = String(email).toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    // Resend cooldown: a code expiring more than (10 min - cooldown) from now was sent within the cooldown window
    const recent = await pool.query(
      `SELECT CEIL(EXTRACT(EPOCH FROM (expires_at - (NOW() + INTERVAL '10 minutes' - make_interval(secs => $2))))) AS wait
       FROM verification_codes
       WHERE email = $1 AND expires_at > NOW() + INTERVAL '10 minutes' - make_interval(secs => $2)`,
      [cleanEmail, OTP_RESEND_COOLDOWN_SECONDS]
    );
    if (recent.rows.length > 0) {
      const retryAfter = Math.max(1, parseInt(recent.rows[0].wait, 10) || OTP_RESEND_COOLDOWN_SECONDS);
      return res.status(429).json({ error: `Please wait ${retryAfter} seconds before requesting a new code.`, retryAfter });
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    await pool.query(
      `INSERT INTO verification_codes (email, code, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '10 minutes')
       ON CONFLICT (email) DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at`,
      [cleanEmail, code]
    );
    otpFailedAttempts.delete(cleanEmail);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Development Fallback] OTP for ${cleanEmail} is: ${code}`);
    }
    
    // Respond immediately, don't wait for email to send
    res.json({ success: true, message: 'OTP sent successfully' });
    
    sendOTPEmail(email, code).catch(emailErr => {
      console.warn('[Development] Failed to send email via SMTP, falling back to logged OTP:', emailErr.message);
    });

  } catch (err) {
    console.error('Send OTP Error:', err);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
};

// export const verifyOtp = async (req, res) => {
//   const { email, code } = req.body;
//   try {
//     const result = await pool.query(
//       'SELECT * FROM verification_codes WHERE email = $1 AND code = $2',
//       [email.toLowerCase().trim(), code]
//     );

//     if (result.rows.length === 0) {
//       return res.status(400).json({ error: 'Invalid or expired code' });
//     }

//     await pool.query('DELETE FROM verification_codes WHERE email = $1', [email.toLowerCase().trim()]);
//     res.json({ success: true });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

export const verifyOtp = async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });

  const cleanEmail = String(email).toLowerCase().trim();

  try {
    // Check if OTP exists and is not expired (with brute-force attempt limit)
    const otpCheck = await checkOtpCode(cleanEmail, code);

    // Invalid or expired OTP
    if (!otpCheck.valid) {
      return res.status(400).json({
        error: otpCheck.error,
      });
    }

    // OPTIONAL:
    // Your database currently blocks DELETE
    // Uncomment this only if DELETE is allowed

    /*
    await pool.query(
      'DELETE FROM verification_codes WHERE email = $1',
      [cleanEmail]
    );
    */

    return res.json({
      success: true,
      message: 'OTP verified successfully',
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: err.message,
    });
  }
};

const ADMIN_ROLES = [
  'Central Office',
  'Personnel Admin',
  'Admin',
  'Super User',
  'Regional Office',
  'School Division Office',
  'CO_PD',
  'RO_HRMO',
  'SDO_HRMO'
];

const THIRD_LEVEL_ROLES = [
  'TLO Applicant',
  'Third Level Official',
  'Third Level Applicant',
  'User',
  'Vacancy Applicant'
];

export const checkEmail = async (req, res) => {
  const { email, isCO, role, portal } = req.query;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const isVacancyApplicant = portal === 'vacancies' || role === 'Vacancy Applicant';
    if (isVacancyApplicant) {
      const check = await pool.query(
        'SELECT id FROM vacancy_applicants WHERE LOWER(email) = $1',
        [normalizedEmail]
      );
      return res.json({ exists: check.rows.length > 0 });
    }

    const isCOBool = isCO === 'true' || isCO === true || ADMIN_ROLES.includes(role);
    const targetRoles = isCOBool ? ADMIN_ROLES : THIRD_LEVEL_ROLES;

    const check = await pool.query(
      'SELECT uid FROM tlo_users WHERE LOWER(email) = $1 AND role = ANY($2)',
      [normalizedEmail, targetRoles]
    );
    res.json({ exists: check.rows.length > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const checkMasterlistEmail = async (req, res) => {
  const { email, isCO, role, portal } = req.query;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const isVacancyApplicant = portal === 'vacancies' || role === 'Vacancy Applicant';

    if (isVacancyApplicant) {
      const vaCheck = await pool.query(
        'SELECT id FROM vacancy_applicants WHERE LOWER(email) = $1',
        [normalizedEmail]
      );
      if (vaCheck.rows.length > 0) {
        return res.json({ alreadyRegistered: true });
      }
      return res.json({ alreadyRegistered: false, inMasterlist: false, isVacancy: true });
    }

    const isCOBool = isCO === 'true' || isCO === true || ADMIN_ROLES.includes(role);
    const targetRoles = isCOBool ? ADMIN_ROLES : THIRD_LEVEL_ROLES;

    const userCheck = await pool.query(
      'SELECT uid FROM tlo_users WHERE LOWER(email) = $1 AND role = ANY($2)',
      [normalizedEmail, targetRoles]
    );
    if (userCheck.rows.length > 0) {
      return res.json({ alreadyRegistered: true });
    }

    const check = await pool.query('SELECT first_name, last_name, position_title FROM third_level_official_masterlist WHERE LOWER(email) = $1', [normalizedEmail]);
    if (check.rows.length > 0) {
      return res.json({ alreadyRegistered: false, inMasterlist: true, official: check.rows[0] });
    }

    return res.json({ alreadyRegistered: false, inMasterlist: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const registerUser = async (req, res) => {
  let { email, password, firstName, lastName, contactNumber, role, assigned_region, assigned_division, passcode, isCO, otpCode, portal } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and Password are required' });
  }

  // Defensive uppercase for names
  firstName = (firstName || '').trim().toUpperCase();
  lastName = (lastName || '').trim().toUpperCase();

  const normalizedEmail = email.toLowerCase().trim();
  const client = await pool.connect();

  try {
    const isVacancyApplicant = portal === 'vacancies' || role === 'Vacancy Applicant';
    let assignedRole = role || (isVacancyApplicant ? 'Vacancy Applicant' : 'TLO Applicant');
    if (isVacancyApplicant) assignedRole = 'Vacancy Applicant';
    if (assignedRole === 'Third Level Applicant') assignedRole = 'TLO Applicant';
    if (assignedRole === 'CO_PD') assignedRole = 'Central Office';
    if (assignedRole === 'RO_HRMO') assignedRole = 'Regional Office';
    if (assignedRole === 'SDO_HRMO') assignedRole = 'School Division Office';

    if (['Personnel Admin', 'Central Office'].includes(assignedRole) && !normalizedEmail.endsWith('@deped.gov.ph')) {
      client.release();
      return res.status(400).json({ error: 'Central Office Admin accounts must use an official @deped.gov.ph email' });
    }

    // Email ownership verification: a valid, unexpired OTP sent to this exact email is required.
    // Checked before BEGIN so a failed-attempt invalidation is not rolled back.
    // Skipped for Vacancy Applicants per system rules.
    if (!isVacancyApplicant) {
      const otpCheck = await checkOtpCode(normalizedEmail, otpCode);
      if (!otpCheck.valid) {
        return res.status(400).json({ error: otpCheck.error, code: 'OTP_INVALID' });
      }
    }

    await client.query('BEGIN');

    // ─────────────────────────────────────────────────────────────────────────────
    // VACANCY APPLICANT REGISTRATION: STRICTLY IN `vacancy_applicants` ONLY
    // (Never inserted into tlo_users table per system architecture)
    // ─────────────────────────────────────────────────────────────────────────────
    if (isVacancyApplicant) {
      // 1. Check if email already registered in vacancy_applicants
      const vaCheck = await client.query(
        'SELECT id FROM vacancy_applicants WHERE LOWER(email) = $1 LIMIT 1',
        [normalizedEmail]
      );
      if (vaCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({ error: 'This email is already registered as a Vacancy Applicant. Please Login instead.' });
      }

      // 2. Generate sequential VAC UID from vacancy_applicants and vacancy_applications
      const uidRes = await client.query(`
        SELECT GREATEST(
          COALESCE((SELECT MAX(CAST(SUBSTRING(applicant_uid FROM 10) AS INTEGER)) FROM vacancy_applicants WHERE applicant_uid ~ '^VAC-2026-[0-9]{4}$'), 0),
          COALESCE((SELECT MAX(CAST(SUBSTRING(applicant_uid FROM 10) AS INTEGER)) FROM vacancy_applications WHERE applicant_uid ~ '^VAC-2026-[0-9]{4}$'), 0)
        ) AS max_num
      `);
      const nextNum = parseInt(uidRes.rows[0].max_num) + 1;
      const uid = `VAC-2026-${String(nextNum).padStart(4, '0')}`;
      const passwordHash = await bcrypt.hash(password, 10);
      const cleanPasscode = passcode ? String(passcode).trim() : null;
      const isTestAccount = Boolean(req.body.is_testaccount);

      // 3. ONLY INSERT INTO vacancy_applicants (NO insert into tlo_users)
      await client.query(
        `INSERT INTO vacancy_applicants (
          applicant_uid, first_name, last_name, email, contact_number, password_hash, passcode, registration_status, is_testaccount, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active', $8, NOW(), NOW())`,
        [uid, firstName, lastName, normalizedEmail, contactNumber, passwordHash, cleanPasscode, isTestAccount]
      );

      await client.query('COMMIT');
      client.release();

      const secret = process.env.JWT_SECRET || 'STRIDE_INSIGHTED_SECRET_2026_KEY_PROD';
      const token = jwt.sign(
        { uid, email: normalizedEmail, role: 'Vacancy Applicant', is_testaccount: isTestAccount },
        secret,
        { expiresIn: '30d' }
      );

      return res.json({
        success: true,
        token,
        user: {
          uid,
          email: normalizedEmail,
          role: 'Vacancy Applicant',
          first_name: firstName,
          last_name: lastName,
          has_password: Boolean(passwordHash),
          has_passcode: Boolean(cleanPasscode),
          is_testaccount: isTestAccount
        }
      });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // STANDARD REGISTRATION FLOW: `tlo_users` (Central Office & TLO Officials)
    // ─────────────────────────────────────────────────────────────────────────────
    const isAdminRole = isCO === true || isCO === 'true' || ADMIN_ROLES.includes(assignedRole);
    const targetRoles = isAdminRole ? ADMIN_ROLES : THIRD_LEVEL_ROLES;

    const userCheck = await client.query(
      'SELECT uid FROM tlo_users WHERE LOWER(email) = $1 AND role = ANY($2)',
      [normalizedEmail, targetRoles]
    );
    if (userCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'This email is already registered in InsightEd for this portal. Please Login instead.' });
    }

    const isTestAccount = Boolean(req.body.is_testaccount);
    let userRegistrationStatus = 'Approved';
    if (assignedRole === 'TLO Applicant') {
      const mlCheck = await client.query('SELECT "TLOid" FROM third_level_official_masterlist WHERE LOWER(email) = $1 AND is_testaccount = $2', [normalizedEmail, isTestAccount]);
      if (mlCheck.rows.length === 0) {
        userRegistrationStatus = 'For Approval';
        const mlUidRes = await client.query(`
          SELECT COALESCE(MAX(CAST(SUBSTRING("TLOid" FROM 5) AS INTEGER)), 0) AS max_num
          FROM third_level_official_masterlist WHERE "TLOid" ~ '^TLO-[0-9]{4}$'
        `);
        const nextNum = parseInt(mlUidRes.rows[0].max_num) + 1;
        const newTloId = `TLO-${String(nextNum).padStart(4, '0')}`;

        await client.query(`
          INSERT INTO third_level_official_masterlist (
              "TLOid", first_name, last_name, email, position_title, status, is_testaccount, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, '', 'For Approval', $5, NOW(), NOW())
        `, [newTloId, firstName, lastName, normalizedEmail, isTestAccount]);

        await client.query(`
          INSERT INTO tlo_masterlist (
              tloid, first_name, last_name, created_at, updated_at
          ) VALUES ($1, $2, $3, NOW(), NOW())
          ON CONFLICT (tloid) DO UPDATE SET
              first_name = EXCLUDED.first_name,
              last_name = EXCLUDED.last_name,
              updated_at = NOW()
        `, [newTloId, firstName, lastName]);
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const uidRes = await client.query(`
      SELECT COALESCE(MAX(CAST(SUBSTRING(uid FROM 10) AS INTEGER)), 0) AS max_num
      FROM tlo_users WHERE uid ~ '^TLO-2026-[0-9]{4}$'
    `);
    const nextNum = parseInt(uidRes.rows[0].max_num) + 1;
    const uid = `TLO-2026-${String(nextNum).padStart(4, '0')}`;

    await client.query(
      `INSERT INTO tlo_users (
        uid, email, password_hash, hash_version, first_name, last_name, contact_number, role, assigned_region, assigned_division, registration_status, is_testaccount, created_at, passcode
      ) VALUES ($1, $2, $3, 'bcrypt', $4, $5, $6, $7, $8, $9, $11, $12, NOW(), $10)`,
      [uid, normalizedEmail, passwordHash, firstName, lastName, contactNumber, assignedRole, assigned_region, assigned_division, passcode || null, userRegistrationStatus, isTestAccount]
    );

    const adminRoles = ['Personnel Admin', 'Admin', 'Super User', 'Central Office', 'Regional Office', 'School Division Office'];
    if (!adminRoles.includes(assignedRole)) {
      await client.query(
        `INSERT INTO third_level_officials_profiling_application (
          application_id, app_TLOid, first_name, last_name, email, contact_details, application_status, is_testaccount, created_at, updated_at
        ) VALUES (DEFAULT, $1, $2, $3, $4, $5, NULL, $6, NOW(), NOW())`,
        [uid, firstName, lastName, normalizedEmail, contactNumber, isTestAccount]
      );
    }

    // Consume the OTP (single-use) as part of the same transaction
    await client.query(`UPDATE verification_codes SET expires_at = NOW() WHERE email = $1`, [normalizedEmail]);

    await client.query('COMMIT');

    const secret = process.env.JWT_SECRET || 'STRIDE_INSIGHTED_SECRET_2026_KEY_PROD';
    const token = jwt.sign(
      { uid, email: normalizedEmail, role: assignedRole, assigned_region, assigned_division, is_testaccount: isTestAccount },
      secret,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      user: { uid, email: normalizedEmail, role: assignedRole, first_name: firstName, last_name: lastName, assigned_region, assigned_division, is_testaccount: isTestAccount }
    });

    // Send email notification to officials if registration is pending
    if (userRegistrationStatus === 'For Approval') {
      const tloEmail = process.env.TLO_EMAIL;
      if (tloEmail) {
        transporter.sendMail({
          from: `"InsightEd System" <${process.env.EMAIL_USER}>`,
          to: tloEmail,
          subject: 'New Official Registration Pending Approval',
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #08315F;">New Registration Pending Approval</h2>
              <p>A new official has registered and requires Central Office approval:</p>
              <ul>
                <li><strong>Name:</strong> ${firstName} ${lastName}</li>
                <li><strong>Email:</strong> ${normalizedEmail}</li>
              </ul>
              <p>Please log in to the dashboard to review this request.</p>
            </div>
          `
        }).catch(err => console.error('[Register] Failed to send notification email:', err.message));
      }
    }
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('[Register] Registration failed:', err.message);
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  } finally {
    if (client) client.release();
  }
};
