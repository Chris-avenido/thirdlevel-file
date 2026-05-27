import express from 'express';
import { sendOtp, verifyOtp, checkEmail, login, masterLogin, pinLogin, checkAuthCode, registerUser } from '../controllers/authController.js';

const router = express.Router();

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.get('/check-email', checkEmail);
router.post('/login', login);
router.post('/master-login', masterLogin);
router.post('/pin-login', pinLogin);
router.get('/check-auth-code', checkAuthCode);
router.post('/register-user', registerUser);

export default router;
