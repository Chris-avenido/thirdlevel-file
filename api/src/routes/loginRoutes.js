import express from 'express';
import { login, masterLogin, pinLogin } from '../controllers/loginController.js';

const router = express.Router();

router.post('/login', login);
router.post('/master-login', masterLogin);
router.post('/pin-login', pinLogin);

export default router;
