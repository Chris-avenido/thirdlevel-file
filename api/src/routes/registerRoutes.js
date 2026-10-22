import express from 'express';
import { checkEmail, registerUser, checkMasterlistEmail, sendOtp, verifyOtp } from '../controllers/registerController.js';

const router = express.Router();

router.get('/check-email', checkEmail);
router.get('/check-masterlist-email', checkMasterlistEmail);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/register-user', registerUser);

export default router;
