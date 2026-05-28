import express from 'express';
import { checkEmail, registerUser, sendOtp, verifyOtp } from '../controllers/registerController.js';

const router = express.Router();

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.get('/check-email', checkEmail);
router.post('/register-user', registerUser);

export default router;
