import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import pool from '../config/db.js';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

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

export const sendOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await pool.query(
      `INSERT INTO verification_codes (email, code, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '10 minutes')
       ON CONFLICT (email) DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at`,
      [email.toLowerCase().trim(), code]
    );

    await sendOTPEmail(email, code);
    res.json({ success: true, message: 'OTP sent successfully' });
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

  const cleanEmail = email.toLowerCase().trim();

  console.log(cleanEmail, code);

  try {
    // Check if OTP exists and is not expired
    const result = await pool.query(
      `
      SELECT *
      FROM verification_codes
      WHERE email = $1
      AND code = $2
      AND expires_at > NOW()
      `,
      [cleanEmail, code]
    );

    console.log(result.rows);

    // Invalid or expired OTP
    if (result.rows.length === 0) {
      return res.status(400).json({
        error: 'Invalid or expired code',
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

export const checkEmail = async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    const check = await pool.query('SELECT uid FROM users WHERE LOWER(email) = $1', [email.toLowerCase().trim()]);
    res.json({ exists: check.rows.length > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const registerUser = async (req, res) => {
  const { email, password, firstName, lastName, contactNumber, authCode } = req.body;

  if (!email || !password || !authCode) {
    return res.status(400).json({ error: 'Email, Password, and Authorization Code are required' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const client = await pool.connect();

  try {
    const authCheck = await client.query(
      'SELECT role FROM authorization_codes WHERE code = $1 AND is_active = TRUE',
      [authCode.toUpperCase().trim()]
    );
    console.log(authCheck.rows);

    if (authCheck.rows.length === 0) {
      client.release();
      return res.status(403).json({ error: 'Invalid Authorization Code. Please contact your administrator.' });
    }

    let assignedRole = authCheck.rows[0].role;
    if (assignedRole === 'Third Level Applicant') assignedRole = 'TLO Applicant';
    if (assignedRole === 'Central Office') assignedRole = 'Personnel Admin';

    if (assignedRole === 'Personnel Admin' && !normalizedEmail.endsWith('@deped.gov.ph')) {
      client.release();
      return res.status(400).json({ error: 'Central Office Admin accounts must use an official @deped.gov.ph email' });
    }

    await client.query('BEGIN');

    const userCheck = await client.query('SELECT uid FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
    if (userCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: 'This email is already registered in InsightEd. Please Login instead.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const uidRes = await client.query(`
      SELECT COALESCE(MAX(CAST(SUBSTRING(uid FROM 10) AS INTEGER)), 0) AS max_num
      FROM users WHERE uid ~ '^TLO-2026-[0-9]{4}$'
    `);
    const nextNum = parseInt(uidRes.rows[0].max_num) + 1;
    const uid = `TLO-2026-${String(nextNum).padStart(4, '0')}`;

    await client.query(
      `INSERT INTO users (
        uid, email, password_hash, first_name, last_name, contact_number, role, registration_status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Approved', NOW())`,
      [uid, normalizedEmail, passwordHash, firstName, lastName, contactNumber, assignedRole]
    );

    if (assignedRole !== 'Personnel Admin') {
      await client.query(
        `INSERT INTO third_level_officials_profiling_application (
          application_id, app_TLOid, first_name, last_name, email, contact_details, application_status, created_at, updated_at
        ) VALUES (DEFAULT, $1, $2, $3, $4, $5, NULL, NOW(), NOW())`,
        [uid, firstName, lastName, normalizedEmail, contactNumber]
      );
    }

    await client.query('COMMIT');

    const secret = process.env.JWT_SECRET || 'STRIDE_INSIGHTED_SECRET_2026_KEY_PROD';
    const token = jwt.sign(
      { uid, email: normalizedEmail, role: assignedRole },
      secret,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      user: { uid, email: normalizedEmail, role: assignedRole, first_name: firstName, last_name: lastName }
    });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('[Register] Registration failed:', err.message);
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  } finally {
    if (client) client.release();
  }
};
