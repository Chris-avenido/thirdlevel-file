import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {
  adminAction,
  getActiveOfficials,
  getApplications,
  getUnassignedPersonnel,
  processApplication,
  getOfficials,
  getPositionIncumbents,
  getLastVacateUpdate,
  triggerCron
} from '../controllers/thirdLevelController.js';
import { bulkProcessDirectory, bulkProcessAchievements } from '../controllers/uploadDirectoryModalController.js';

const router = express.Router();

router.get('/applications', authMiddleware, getApplications);
router.post('/process-application', authMiddleware, processApplication);
router.get('/officials', authMiddleware, getOfficials);
router.get('/officials/:TLOid/last-vacate-update', authMiddleware, getLastVacateUpdate);
router.get('/position-incumbents', authMiddleware, getPositionIncumbents);
router.get('/active-officials', authMiddleware, getActiveOfficials);
router.get('/unassigned-personnel', authMiddleware, getUnassignedPersonnel);
router.post('/admin-action', authMiddleware, adminAction);
router.post('/bulk-process-directory', authMiddleware, bulkProcessDirectory);
router.post('/bulk-process-achievements', authMiddleware, bulkProcessAchievements);
router.get('/cron-trigger', triggerCron);

export default router;
