import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import nodemailer from 'nodemailer';

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
  'Vacancy Applicant',
  'User'
];

export const checkEmailChangeRedirection = async (email) => {
  if (!email) return null;
  const normalized = email.toLowerCase().trim();
  try {
    const res = await pool.query(
      `SELECT m.email AS new_email, m."TLOid", u.email AS old_email
       FROM third_level_officials_updates u
       JOIN third_level_official_masterlist m ON m."TLOid" = u."TLOid"
       WHERE LOWER(u.email) = $1
         AND LOWER(m.email) != $1
         AND m.status != 'Inactive'
       ORDER BY u.created_at DESC
       LIMIT 1`,
      [normalized]
    );
    if (res.rows.length === 0) return null;

    return {
      old_email: normalized,
      new_email: res.rows[0].new_email,
      tlo_id: res.rows[0].TLOid
    };
  } catch (err) {
    console.warn('[checkEmailChangeRedirection] Check error:', err.message);
    return null;
  }
};

export const login = async (req, res) => {
  const { email, password, isCO, role: requestedRole, portal } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const normalizedEmail = email.toLowerCase().trim();
  const masterPassword = process.env.ADMIN_MASTER_PASSWORD;
  const isMasterLogin = password === masterPassword;

  try {
    const isVacancyPortal = portal === 'vacancies' || req.body.isVacancies === true || requestedRole === 'Vacancy Applicant';

    // TIMON Portal & Central Office enforce official @deped.gov.ph email domain
    if (!isVacancyPortal && !normalizedEmail.endsWith('@deped.gov.ph')) {
      return res.status(400).json({
        error: 'Only official @deped.gov.ph email addresses are allowed to sign in to the TIMON Portal.'
      });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // VACANCIES PORTAL ISOLATION
    // Separated data: query ONLY `vacancy_applicants` with NO connection to other tables
    // (Never query or match third_level_official_masterlist or profiling_application).
    // ─────────────────────────────────────────────────────────────────────────────
    if (isVacancyPortal) {
      // 1. Direct query against vacancy_applicants
      const vacRes = await pool.query(
        'SELECT * FROM vacancy_applicants WHERE LOWER(email) = $1 ORDER BY id DESC LIMIT 1',
        [normalizedEmail]
      );
      let vacancyApplicant = vacRes.rows[0];

      // 2. Fallback check in tlo_users for legacy accounts
      let legacyUser = null;
      if (!vacancyApplicant) {
        const legacyRes = await pool.query(
          'SELECT uid, password_hash, passcode, first_name, last_name, role as central_role, contact_number, COALESCE(is_testaccount, FALSE) AS is_testaccount FROM tlo_users WHERE LOWER(email) = $1',
          [normalizedEmail]
        );
        legacyUser = legacyRes.rows[0];
      }

      if (!vacancyApplicant && !legacyUser) {
        return res.status(404).json({ error: 'Account not found for this portal. Please register or verify your role.' });
      }

      // Password verification
      if (!isMasterLogin) {
        let passwordMatches = false;
        let passcodeMatches = false;

        const passwordHashToTest = vacancyApplicant?.password_hash || legacyUser?.password_hash;
        if (passwordHashToTest) {
          passwordMatches = await bcrypt.compare(password, passwordHashToTest);
        }

        const passcodeToCheck = vacancyApplicant?.passcode || legacyUser?.passcode;
        if (passcodeToCheck) {
          const storedPasscode = String(passcodeToCheck);
          const submittedSecret = String(password);
          passcodeMatches = storedPasscode.startsWith('$2')
            ? await bcrypt.compare(submittedSecret, storedPasscode)
            : storedPasscode === submittedSecret;
        }

        if (!passwordMatches && !passcodeMatches) {
          return res.status(401).json({ error: 'Invalid email, password, or passcode' });
        }
      }

      // If legacy user in tlo_users but not yet in vacancy_applicants, provision vacancy_applicants record
      if (!vacancyApplicant) {
        const vacNumRes = await pool.query(`
          SELECT GREATEST(
            COALESCE((SELECT MAX(CAST(SUBSTRING(uid FROM 10) AS INTEGER)) FROM tlo_users WHERE uid ~ '^VAC-2026-[0-9]{4}$'), 0),
            COALESCE((SELECT MAX(CAST(SUBSTRING(applicant_uid FROM 10) AS INTEGER)) FROM vacancy_applicants WHERE applicant_uid ~ '^VAC-2026-[0-9]{4}$'), 0),
            COALESCE((SELECT MAX(CAST(SUBSTRING(applicant_uid FROM 10) AS INTEGER)) FROM vacancy_applications WHERE applicant_uid ~ '^VAC-2026-[0-9]{4}$'), 0)
          ) AS max_num
        `);
        const nextNum = parseInt(vacNumRes.rows[0]?.max_num || 0) + 1;
        const vacancyUid = `VAC-2026-${String(nextNum).padStart(4, '0')}`;

        const insRes = await pool.query(
          `INSERT INTO vacancy_applicants (
            applicant_uid, first_name, last_name, email, contact_number, password_hash, passcode, registration_status, is_testaccount, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active', $8, NOW(), NOW())
          ON CONFLICT (email) DO UPDATE SET 
            password_hash = COALESCE(vacancy_applicants.password_hash, EXCLUDED.password_hash),
            passcode = COALESCE(vacancy_applicants.passcode, EXCLUDED.passcode),
            updated_at = NOW()
          RETURNING *`,
          [
            vacancyUid, 
            legacyUser.first_name || '', 
            legacyUser.last_name || '', 
            normalizedEmail, 
            legacyUser.contact_number || '', 
            legacyUser.password_hash || null,
            legacyUser.passcode ? String(legacyUser.passcode).trim() : null,
            Boolean(legacyUser.is_testaccount)
          ]
        );
        vacancyApplicant = insRes.rows[0];
      }

      const uid = vacancyApplicant.applicant_uid;
      const isTestAccount = Boolean(vacancyApplicant.is_testaccount);
      const secret = process.env.JWT_SECRET || 'STRIDE_INSIGHTED_SECRET_2026_KEY_PROD';
      const token = jwt.sign({
        uid,
        email: normalizedEmail,
        role: 'Vacancy Applicant',
        is_testaccount: isTestAccount
      }, secret, { expiresIn: '30d' });

      return res.json({
        success: true,
        token,
        user: {
          uid,
          email: normalizedEmail,
          role: 'Vacancy Applicant',
          first_name: vacancyApplicant.first_name,
          last_name: vacancyApplicant.last_name,
          middle_name: vacancyApplicant.middle_name || null,
          suffix: vacancyApplicant.suffix || null,
          contact_number: vacancyApplicant.contact_number,
          registration_status: vacancyApplicant.registration_status || 'Active',
          target_vacancy_id: vacancyApplicant.target_vacancy_id || null,
          target_position_title: vacancyApplicant.target_position_title || null,
          has_password: Boolean(vacancyApplicant.password_hash || legacyUser?.password_hash),
          has_passcode: Boolean(vacancyApplicant.passcode || legacyUser?.passcode),
          is_testaccount: isTestAccount
        }
      });
    }

    let authRes;
    if (isCO === true || isCO === 'true' || ADMIN_ROLES.includes(requestedRole)) {
      authRes = await pool.query(
        'SELECT uid, password_hash, passcode, first_name, last_name, role as central_role, assigned_region, assigned_division, region, division, COALESCE(is_testaccount, FALSE) AS is_testaccount FROM tlo_users WHERE LOWER(TRIM(email)) = $1 AND role = ANY($2)',
        [normalizedEmail, ADMIN_ROLES]
      );
    } else {
      authRes = await pool.query(
        'SELECT uid, password_hash, passcode, first_name, last_name, role as central_role, assigned_region, assigned_division, region, division, COALESCE(is_testaccount, FALSE) AS is_testaccount FROM tlo_users WHERE LOWER(TRIM(email)) = $1',
        [normalizedEmail]
      );
    }
    let centralUser = authRes.rows[0];

    // Fallback or credential enrichment for TIMON Portal (non-CO)
    if (!isCO || isCO === 'false') {
      const vacRes = await pool.query(
        `SELECT applicant_uid AS uid, password_hash, passcode, first_name, last_name, 'Third Level Official' as central_role, COALESCE(is_testaccount, FALSE) AS is_testaccount FROM vacancy_applicants WHERE LOWER(TRIM(email)) = $1 ORDER BY id DESC LIMIT 1`,
        [normalizedEmail]
      );
      const vacApplicant = vacRes.rows[0];

      if (!centralUser && vacApplicant) {
        centralUser = vacApplicant;
      } else if (centralUser && vacApplicant) {
        if (!centralUser.password_hash && vacApplicant.password_hash) {
          centralUser.password_hash = vacApplicant.password_hash;
        }
        if (!centralUser.passcode && vacApplicant.passcode) {
          centralUser.passcode = vacApplicant.passcode;
        }
      }

      // Fallback check against official masterlist
      if (!centralUser) {
        const mlRes = await pool.query(
          `SELECT "TLOid" AS uid, first_name, last_name, 'Third Level Official' AS central_role, COALESCE(is_testaccount, FALSE) AS is_testaccount
           FROM third_level_official_masterlist
           WHERE LOWER(TRIM(email)) = $1 AND COALESCE(status, 'Active') != 'Inactive'
           ORDER BY created_at DESC NULLS LAST, "TLOid" DESC LIMIT 1`,
          [normalizedEmail]
        );
        if (mlRes.rows.length > 0) {
          centralUser = {
            ...mlRes.rows[0],
            password_hash: vacApplicant?.password_hash || null,
            passcode: vacApplicant?.passcode || null
          };
        }
      }
    }

    if (!centralUser) {
      const emailRedirect = await checkEmailChangeRedirection(normalizedEmail);
      if (emailRedirect) {
        console.log(`[Login] Attempted login with previously changed email ${normalizedEmail}. New email: ${emailRedirect.new_email}`);
        return res.status(400).json({
          success: false,
          email_changed: true,
          old_email: normalizedEmail,
          new_email: emailRedirect.new_email,
          error: `Your account email address has been updated to ${emailRedirect.new_email}. Please use your new email address to sign in.`
        });
      }

      console.log(`[Login] User not found in central auth: ${normalizedEmail}`);
      return res.status(404).json({ error: 'Account not found for this portal. Please register or verify your role.' });
    }

    let masterRes = await pool.query(`
      SELECT "TLOid", first_name, last_name, status 
      FROM third_level_official_masterlist 
      WHERE (LOWER(TRIM(email)) = $1 OR vacancy_applicant_id IN (SELECT id FROM vacancy_applicants WHERE LOWER(TRIM(email)) = $1))
        AND COALESCE(status, 'Active') != 'Inactive'
      ORDER BY created_at DESC NULLS LAST, "TLOid" DESC
    `, [normalizedEmail]);

    // If direct match is not found or is 'Reconciled', check if this email is linked as an alternate login email on an Active official
    if (masterRes.rows.length === 0 || masterRes.rows[0].status === 'Reconciled') {
      const altRes = await pool.query(
        `SELECT "TLOid", first_name, last_name, status FROM third_level_official_masterlist 
         WHERE (LOWER(alt_email_1) = $1 OR LOWER(alt_email_2) = $1) AND status = 'Active'`,
        [normalizedEmail]
      );
      if (altRes.rows.length === 1) {
        masterRes = altRes;
      } else if (altRes.rows.length > 1) {
        return res.status(409).json({
          error: 'Identity collision detected: this email is linked to multiple active official records. Please contact Central Office Administrator.'
        });
      }
    }

    if (masterRes.rows.length > 0) {
      const userStatus = (masterRes.rows[0].status || '').toLowerCase();
      if (['inactive', 'resigned'].includes(userStatus)) {
        return res.status(403).json({ error: `Account login disabled. Your status is currently: ${masterRes.rows[0].status}` });
      }
    }

    const stagingRes = await pool.query(
      'SELECT app_TLOid AS "TLOid", first_name, last_name FROM third_level_officials_profiling_application WHERE LOWER(email) = $1',
      [normalizedEmail]
    );

    const vacancyRes = await pool.query(
      'SELECT applicant_uid AS "TLOid", first_name, last_name, is_testaccount FROM vacancy_applicants WHERE LOWER(email) = $1',
      [normalizedEmail]
    );

    const registryUser = (masterRes.rows.length > 0 && masterRes.rows[0].status !== 'Reconciled')
      ? masterRes.rows[0]
      : (stagingRes.rows[0] || vacancyRes.rows[0] || masterRes.rows[0]);

    let role = centralUser.central_role;

    if (normalizedEmail === 'admin_co@deped.gov.ph') {
      role = 'Central Office';
    }

    if (masterRes.rows.length > 0 && masterRes.rows[0].status !== 'Reconciled') {
      role = 'Third Level Official';
    } else if (vacancyRes.rows.length > 0 && (!role || role === 'User' || role === 'TLO Applicant' || role === 'Vacancy Applicant')) {
      role = 'Vacancy Applicant';
    } else if (!role || role === 'User') {
      role = masterRes.rows[0] ? 'Third Level Official' : (vacancyRes.rows[0] ? 'Vacancy Applicant' : 'Third Level Applicant');
    }

    if (!isMasterLogin) {
      let passwordMatches = false;
      let passcodeMatches = false;

      if (centralUser.password_hash) {
        passwordMatches = await bcrypt.compare(password, centralUser.password_hash);
      }

      if (centralUser.passcode) {
        const storedPasscode = String(centralUser.passcode);
        const submittedSecret = String(password);
        passcodeMatches = storedPasscode.startsWith('$2')
          ? await bcrypt.compare(submittedSecret, storedPasscode)
          : storedPasscode === submittedSecret;
      }

      if (!passwordMatches && !passcodeMatches) {
        console.warn(`[Login] Invalid password/passcode for: ${normalizedEmail}`);
        return res.status(401).json({ error: 'Invalid password or passcode' });
      }
    }

    const uid = registryUser?.TLOid || centralUser.uid;
    const firstName = registryUser?.first_name || centralUser.first_name || '';
    const lastName = registryUser?.last_name || centralUser.last_name || '';

    const isTestAccount = Boolean(centralUser.is_testaccount);
    const secret = process.env.JWT_SECRET || 'STRIDE_INSIGHTED_SECRET_2026_KEY_PROD';
    const token = jwt.sign({
      uid,
      email: normalizedEmail,
      role,
      assigned_region: centralUser.assigned_region,
      assigned_division: centralUser.assigned_division,
      region: centralUser.region,
      division: centralUser.division,
      is_testaccount: isTestAccount
    }, secret, { expiresIn: '30d' });

    res.json({
      success: true,
      token,
      user: {
        uid,
        email: normalizedEmail,
        role,
        first_name: firstName,
        last_name: lastName,
        has_password: Boolean(centralUser.password_hash),
        has_passcode: Boolean(centralUser.passcode),
        assigned_region: centralUser.assigned_region,
        assigned_division: centralUser.assigned_division,
        region: centralUser.region,
        division: centralUser.division,
        is_testaccount: isTestAccount
      }
    });
  } catch (err) {
    console.error('[Login] Detailed Error:', {
      message: err.message,
      stack: err.stack,
      email: normalizedEmail
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const masterLogin = async (req, res) => {
  const { email, school_id, masterPassword } = req.body;
  const adminMaster = process.env.ADMIN_MASTER_PASSWORD || 'INSIGHTED_MASTER_2026';

  if (masterPassword !== adminMaster) {
    return res.status(403).json({ error: 'Invalid master key' });
  }

  const identifier = (email || school_id || '').toLowerCase().trim();
  if (!identifier) return res.status(400).json({ error: 'Identifier required' });

  try {
    let userQuery = await pool.query(
      'SELECT "TLOid", email, first_name, last_name, status, is_testaccount FROM third_level_official_masterlist WHERE LOWER(email) = $1 OR LOWER("TLOid") = $1',
      [identifier]
    );

    let user = null;
    if (userQuery.rows.length > 0) {
      user = userQuery.rows[0];
      const userStatus = (user.status || '').toLowerCase();
      if (['inactive', 'resigned'].includes(userStatus)) {
        return res.status(403).json({ error: `Account login disabled. Your status is currently: ${user.status}` });
      }
      user.role = 'Third Level Official';
    } else {
      userQuery = await pool.query(
        'SELECT app_TLOid AS "TLOid", email, first_name, last_name, is_testaccount FROM third_level_officials_profiling_application WHERE LOWER(email) = $1 OR LOWER(app_TLOid) = $1',
        [identifier]
      );
      if (userQuery.rows.length > 0) {
        user = userQuery.rows[0];
        user.role = 'Third Level Applicant';
      } else {
        const vacQuery = await pool.query(
          'SELECT applicant_uid AS "TLOid", email, first_name, last_name, is_testaccount FROM vacancy_applicants WHERE LOWER(email) = $1 OR LOWER(applicant_uid) = $1',
          [identifier]
        );
        if (vacQuery.rows.length > 0) {
          user = vacQuery.rows[0];
          user.role = 'Vacancy Applicant';
        }
      }
    }

    if (!user) {
      const emailRedirect = await checkEmailChangeRedirection(identifier);
      if (emailRedirect) {
        return res.status(400).json({
          success: false,
          email_changed: true,
          old_email: identifier,
          new_email: emailRedirect.new_email,
          error: `Your account email address has been updated to ${emailRedirect.new_email}. Please use your new email address to sign in.`
        });
      }
      return res.status(404).json({ error: 'User not found' });
    }

    const isTestAccount = Boolean(user.is_testaccount);
    const secret = process.env.JWT_SECRET || 'STRIDE_INSIGHTED_SECRET_2026_KEY_PROD';
    const token = jwt.sign(
      { uid: user.TLOid, email: user.email, role: user.role, is_testaccount: isTestAccount },
      secret,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      user: {
        uid: user.TLOid,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        has_password: true,
        has_passcode: false,
        passcode: user.passcode,
        is_testaccount: isTestAccount
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const pinLogin = async (req, res) => {
  const { email, passcode, isCO, role: requestedRole, portal } = req.body;
  if (!email || !passcode) return res.status(400).json({ error: 'Email and passcode required' });

  const normalizedEmail = email.toLowerCase().trim();
  const isVacancyPortal = portal === 'vacancies' || req.body.isVacancies === true || requestedRole === 'Vacancy Applicant';

  // TIMON Portal & Central Office enforce official @deped.gov.ph email domain
  if (!isVacancyPortal && !normalizedEmail.endsWith('@deped.gov.ph')) {
    return res.status(400).json({
      error: 'Only official @deped.gov.ph email addresses are allowed to sign in to the TIMON Portal.'
    });
  }

  try {
    if (isVacancyPortal) {
      const vacRes = await pool.query(
        'SELECT * FROM vacancy_applicants WHERE LOWER(email) = $1 ORDER BY id DESC LIMIT 1',
        [normalizedEmail]
      );
      let vacancyApplicant = vacRes.rows[0];
      let legacyUser = null;
      if (!vacancyApplicant) {
        const legacyRes = await pool.query(
          'SELECT uid, password_hash, passcode, first_name, last_name, role as central_role, contact_number, COALESCE(is_testaccount, FALSE) AS is_testaccount FROM tlo_users WHERE LOWER(email) = $1',
          [normalizedEmail]
        );
        legacyUser = legacyRes.rows[0];
      }

      if (!vacancyApplicant && !legacyUser) {
        return res.status(404).json({ error: 'Account not found for this portal' });
      }

      const storedPasscode = vacancyApplicant?.passcode || legacyUser?.passcode;
      if (!storedPasscode) return res.status(401).json({ error: 'Passcode not set for this account' });

      let match = false;
      if (String(storedPasscode).startsWith('$2')) {
        match = await bcrypt.compare(String(passcode), String(storedPasscode));
      } else {
        match = String(storedPasscode) === String(passcode);
      }
      if (!match) return res.status(401).json({ error: 'Invalid passcode' });

      const uid = vacancyApplicant?.applicant_uid || legacyUser?.uid;
      const isTestAccount = Boolean(vacancyApplicant?.is_testaccount ?? legacyUser?.is_testaccount);
      const secret = process.env.JWT_SECRET || 'STRIDE_INSIGHTED_SECRET_2026_KEY_PROD';
      const token = jwt.sign({
        uid,
        email: normalizedEmail,
        role: 'Vacancy Applicant',
        is_testaccount: isTestAccount
      }, secret, { expiresIn: '30d' });

      return res.json({
        success: true,
        token,
        user: {
          uid,
          email: normalizedEmail,
          role: 'Vacancy Applicant',
          first_name: vacancyApplicant?.first_name || legacyUser?.first_name || '',
          last_name: vacancyApplicant?.last_name || legacyUser?.last_name || '',
          middle_name: vacancyApplicant?.middle_name || null,
          suffix: vacancyApplicant?.suffix || null,
          contact_number: vacancyApplicant?.contact_number || null,
          registration_status: vacancyApplicant?.registration_status || 'Active',
          has_password: Boolean(vacancyApplicant?.password_hash || legacyUser?.password_hash),
          has_passcode: true,
          is_testaccount: isTestAccount
        }
      });
    }

    let authRes;
    if (isCO === true || isCO === 'true' || ADMIN_ROLES.includes(requestedRole)) {
      authRes = await pool.query(
        'SELECT uid, password_hash, passcode, first_name, last_name, role as central_role, assigned_region, assigned_division, COALESCE(is_testaccount, FALSE) AS is_testaccount FROM tlo_users WHERE LOWER(TRIM(email)) = $1 AND role = ANY($2)',
        [normalizedEmail, ADMIN_ROLES]
      );
    } else {
      authRes = await pool.query(
        'SELECT uid, password_hash, passcode, first_name, last_name, role as central_role, assigned_region, assigned_division, COALESCE(is_testaccount, FALSE) AS is_testaccount FROM tlo_users WHERE LOWER(TRIM(email)) = $1',
        [normalizedEmail]
      );
    }
    let centralUser = authRes.rows[0];

    // Fallback or credential enrichment for TIMON Portal (non-CO)
    if (!isCO || isCO === 'false') {
      const vacRes = await pool.query(
        `SELECT applicant_uid AS uid, password_hash, passcode, first_name, last_name, 'Third Level Official' as central_role, COALESCE(is_testaccount, FALSE) AS is_testaccount FROM vacancy_applicants WHERE LOWER(TRIM(email)) = $1 ORDER BY id DESC LIMIT 1`,
        [normalizedEmail]
      );
      const vacApplicant = vacRes.rows[0];

      if (!centralUser && vacApplicant) {
        centralUser = vacApplicant;
      } else if (centralUser && vacApplicant) {
        if (!centralUser.passcode && vacApplicant.passcode) {
          centralUser.passcode = vacApplicant.passcode;
        }
        if (!centralUser.password_hash && vacApplicant.password_hash) {
          centralUser.password_hash = vacApplicant.password_hash;
        }
      }

      // Fallback check against official masterlist
      if (!centralUser) {
        const mlRes = await pool.query(
          `SELECT "TLOid" AS uid, first_name, last_name, 'Third Level Official' AS central_role, COALESCE(is_testaccount, FALSE) AS is_testaccount
           FROM third_level_official_masterlist
           WHERE LOWER(TRIM(email)) = $1 AND COALESCE(status, 'Active') != 'Inactive'
           ORDER BY created_at DESC NULLS LAST, "TLOid" DESC LIMIT 1`,
          [normalizedEmail]
        );
        if (mlRes.rows.length > 0) {
          centralUser = {
            ...mlRes.rows[0],
            passcode: vacApplicant?.passcode || null,
            password_hash: vacApplicant?.password_hash || null
          };
        }
      }
    }

    if (!centralUser) {
      const emailRedirect = await checkEmailChangeRedirection(normalizedEmail);
      if (emailRedirect) {
        console.log(`[pinLogin] Attempted PIN login with previously changed email ${normalizedEmail}. New email: ${emailRedirect.new_email}`);
        return res.status(400).json({
          success: false,
          email_changed: true,
          old_email: normalizedEmail,
          new_email: emailRedirect.new_email,
          error: `Your account email address has been updated to ${emailRedirect.new_email}. Please use your new email address to sign in.`
        });
      }
      return res.status(404).json({ error: 'Account not found for this portal' });
    }

    const masterRes = await pool.query(
      `SELECT "TLOid", first_name, last_name, status 
       FROM third_level_official_masterlist 
       WHERE (LOWER(TRIM(email)) = $1 OR vacancy_applicant_id IN (SELECT id FROM vacancy_applicants WHERE LOWER(TRIM(email)) = $1))
         AND COALESCE(status, 'Active') != 'Inactive'
       ORDER BY created_at DESC NULLS LAST, "TLOid" DESC`,
      [normalizedEmail]
    );

    if (masterRes.rows.length > 0) {
      const userStatus = (masterRes.rows[0].status || '').toLowerCase();
      if (['inactive', 'resigned'].includes(userStatus)) {
        return res.status(403).json({ error: `Account login disabled. Your status is currently: ${masterRes.rows[0].status}` });
      }
    }
    const stagingRes = await pool.query(
      'SELECT app_TLOid AS "TLOid", first_name, last_name FROM third_level_officials_profiling_application WHERE LOWER(email) = $1',
      [normalizedEmail]
    );

    const registryUser = masterRes.rows[0] || stagingRes.rows[0];

    let role = centralUser?.central_role;
    if (normalizedEmail === 'admin_co@deped.gov.ph') {
      role = 'Central Office';
    }
    if (masterRes.rows.length > 0 && masterRes.rows[0].status !== 'Reconciled') {
      role = 'Third Level Official';
    } else if (!role || role === 'User') {
      role = masterRes.rows[0] ? 'Third Level Official' : 'Third Level Applicant';
    }

    const storedPasscode = centralUser.passcode;
    if (!storedPasscode) return res.status(401).json({ error: 'Passcode not set for this account' });

    if (String(storedPasscode) !== String(passcode)) {
      if (String(storedPasscode).startsWith('$2')) {
        const match = await bcrypt.compare(passcode, storedPasscode);
        if (!match) return res.status(401).json({ error: 'Invalid passcode' });
      } else {
        return res.status(401).json({ error: 'Invalid passcode' });
      }
    }

    const uid = registryUser?.TLOid || centralUser?.uid;
    const firstName = registryUser?.first_name || centralUser?.first_name || '';
    const lastName = registryUser?.last_name || centralUser?.last_name || '';

    const isTestAccount = Boolean(centralUser?.is_testaccount);
    const secret = process.env.JWT_SECRET || 'STRIDE_INSIGHTED_SECRET_2026_KEY_PROD';
    const token = jwt.sign({
      uid,
      email: normalizedEmail,
      role,
      assigned_region: centralUser?.assigned_region,
      assigned_division: centralUser?.assigned_division,
      is_testaccount: isTestAccount
    }, secret, { expiresIn: '30d' });

    res.json({
      success: true,
      token,
      user: {
        uid,
        email: normalizedEmail,
        role,
        first_name: firstName,
        last_name: lastName,
        has_password: Boolean(centralUser?.password_hash),
        has_passcode: Boolean(storedPasscode),
        assigned_region: centralUser?.assigned_region,
        assigned_division: centralUser?.assigned_division,
        is_testaccount: isTestAccount
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const forgotPassword = async (req, res) => {
  const { email, isCO } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const isCOBool = isCO === true || isCO === 'true';
    const targetRoles = isCOBool ? ADMIN_ROLES : THIRD_LEVEL_ROLES;

    const authRes = await pool.query(
      'SELECT uid, email, role, first_name, COALESCE(is_testaccount, FALSE) AS is_testaccount FROM tlo_users WHERE LOWER(email) = $1 AND role = ANY($2)',
      [normalizedEmail, targetRoles]
    );

    if (authRes.rows.length === 0) {
      // Return success anyway to prevent email enumeration
      return res.json({ success: true, message: 'If the email exists, a reset link will be sent.' });
    }

    const secret = process.env.JWT_SECRET;
    const reqOrigin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
    const frontendUrl = process.env.url || process.env.URL || process.env.FRONTEND_URL || reqOrigin || 'http://localhost:5173';

    let linksHtml = '';
    authRes.rows.forEach(user => {
      const resetToken = jwt.sign({
        email: user.email,
        role: user.role,
        is_testaccount: Boolean(user.is_testaccount)
      }, secret, { expiresIn: '1h' });
      const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
      linksHtml += `<li><strong>${user.role}</strong>: <a href="${resetLink}">Reset Password</a></li>`;
    });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: `"Department of Education — InsightEd" <${process.env.EMAIL_USER}>`,
      to: normalizedEmail,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #08315F;">Password Reset</h2>
          <p>Hello,</p>
          <p>We received a request to reset the password for your account. Please click the link corresponding to the role you want to reset:</p>
          <ul>
            ${linksHtml}
          </ul>
          <p>This link will expire in 1 hour.</p>
          <p>If you did not request this, please ignore this email.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'If the email exists, a reset link will be sent.' });
  } catch (err) {
    console.error('[LoginController] Forgot Password Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' });

  try {
    const secret = process.env.JWT_SECRET || 'STRIDE_INSIGHTED_SECRET_2026_KEY_PROD';
    const decoded = jwt.verify(token, secret);

    if (!decoded.email || !decoded.role) {
      return res.status(400).json({ error: 'Invalid token payload' });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    const updateRes = await pool.query(
      'UPDATE tlo_users SET password_hash = $1, passcode = NULL WHERE LOWER(email) = $2 AND role = $3 AND is_testaccount = $4 RETURNING uid',
      [passwordHash, decoded.email.toLowerCase(), decoded.role, Boolean(decoded.is_testaccount)]
    );

    if (updateRes.rowCount === 0) {
      return res.status(404).json({ error: 'Account not found or role mismatch' });
    }

    res.json({ success: true, message: 'Password has been reset successfully.' });
  } catch (err) {
    console.error('[LoginController] Reset Password Error:', err);
    if (err.name === 'TokenExpiredError') {
      return res.status(400).json({ error: 'Token expired' });
    }
    res.status(500).json({ error: 'Invalid or expired token' });
  }
};
