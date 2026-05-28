import express from 'express';
import { checkAuthCode } from '../controllers/nexusGateController.js';

const router = express.Router();

router.get('/check-auth-code', checkAuthCode);

export default router;
