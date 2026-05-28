import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {
  adminAction,
  getActiveOfficials,
  getApplications,
  getOfficials,
  getPositionIncumbents,
  processApplication
} from '../controllers/thirdLevelController.js';

const router = express.Router();

router.get('/applications', authMiddleware, getApplications);
router.post('/process-application', authMiddleware, processApplication);
router.get('/officials', authMiddleware, getOfficials);
router.get('/position-incumbents', authMiddleware, getPositionIncumbents);
router.get('/active-officials', authMiddleware, getActiveOfficials);
router.post('/admin-action', authMiddleware, adminAction);

export default router;
