import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

export const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const normalizedEmail = email.toLowerCase().trim();
  const masterPassword = process.env.ADMIN_MASTER_PASSWORD;
  const isMasterLogin = password === masterPassword;

  try {
    const authRes = await pool.query(
      'SELECT uid, password_hash, passcode, first_name, last_name, role as central_role, assigned_region, assigned_division, region, division FROM users WHERE LOWER(email) = $1',
      [normalizedEmail]
    );
    const centralUser = authRes.rows[0];

    if (!centralUser) {
      console.log(`[Login] User not found in central auth: ${normalizedEmail}`);
      return res.status(404).json({ error: 'Account not found. Please register first.' });
    }

    const masterRes = await pool.query(
      'SELECT "TLOid", first_name, last_name, status FROM third_level_official_masterlist WHERE LOWER(email) = $1',
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

    let role = centralUser.central_role;

    if (normalizedEmail === 'admin_co@deped.gov.ph') {
      role = 'Central Office';
    }

    if (!role || role === 'User') {
      role = masterRes.rows[0] ? 'Third Level Official' : 'Third Level Applicant';
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

    const secret = process.env.JWT_SECRET || 'STRIDE_INSIGHTED_SECRET_2026_KEY_PROD';
    const token = jwt.sign({
      uid,
      email: normalizedEmail,
      role,
      assigned_region: centralUser.assigned_region,
      assigned_division: centralUser.assigned_division,
      region: centralUser.region,
      division: centralUser.division
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
        assigned_region: centralUser.assigned_region,
        assigned_division: centralUser.assigned_division,
        region: centralUser.region,
        division: centralUser.division
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
      'SELECT "TLOid", email, first_name, last_name, status FROM third_level_official_masterlist WHERE LOWER(email) = $1 OR LOWER("TLOid") = $1',
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
        'SELECT app_TLOid AS "TLOid", email, first_name, last_name FROM third_level_officials_profiling_application WHERE LOWER(email) = $1 OR LOWER(app_TLOid) = $1',
        [identifier]
      );
      if (userQuery.rows.length > 0) {
        user = userQuery.rows[0];
        user.role = 'Third Level Applicant';
      }
    }

    if (!user) return res.status(404).json({ error: 'User not found' });

    const secret = process.env.JWT_SECRET || 'STRIDE_INSIGHTED_SECRET_2026_KEY_PROD';
    const token = jwt.sign(
      { uid: user.TLOid, email: user.email, role: user.role },
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
        passcode: user.passcode
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const pinLogin = async (req, res) => {
  const { email, passcode } = req.body;
  if (!email || !passcode) return res.status(400).json({ error: 'Email and passcode required' });

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const authRes = await pool.query(
      'SELECT uid, passcode, first_name, last_name, role as central_role, assigned_region, assigned_division FROM users WHERE LOWER(email) = $1',
      [normalizedEmail]
    );
    const centralUser = authRes.rows[0];

    if (!centralUser) return res.status(404).json({ error: 'Account not found' });

    const masterRes = await pool.query(
      'SELECT "TLOid", first_name, last_name, status FROM third_level_official_masterlist WHERE LOWER(email) = $1',
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
    const role = masterRes.rows[0] ? 'Third Level Official' : 'Third Level Applicant';

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

    const secret = process.env.JWT_SECRET || 'STRIDE_INSIGHTED_SECRET_2026_KEY_PROD';
    const token = jwt.sign({
      uid,
      email: normalizedEmail,
      role,
      assigned_region: centralUser?.assigned_region,
      assigned_division: centralUser?.assigned_division
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
        passcode: storedPasscode,
        assigned_region: centralUser?.assigned_region,
        assigned_division: centralUser?.assigned_division
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
