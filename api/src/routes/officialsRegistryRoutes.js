import express from 'express';
import multer from 'multer';
import authMiddleware from '../middleware/authMiddleware.js';

const memoryUpload = multer({ storage: multer.memoryStorage() });
import {
  adminAction,
  getActiveOfficials,
  getApplications,
  getUnassignedPersonnel,
  processApplication,
  getOfficials,
  getPositionIncumbents,
  getLastVacateUpdate,
  triggerCron,
  createUnassignedPersonnel,
  registerPersonnel,
  getKpiSummary,
  processRegistration,
  toggleTestAccount,
  reassignOfficial
} from '../controllers/thirdLevelController.js';
import { bulkProcessDirectory, bulkProcessAchievements } from '../controllers/uploadDirectoryModalController.js';
import { getAllNotableAchievements, createNotableAchievement, updateNotableAchievement, deleteNotableAchievement } from '../controllers/notableAchievementsController.js';

const router = express.Router();

router.get('/notable-achievements-full', authMiddleware, getAllNotableAchievements);
router.post('/notable-achievements', authMiddleware, createNotableAchievement);
router.put('/notable-achievements/:index_number', authMiddleware, updateNotableAchievement);
router.delete('/notable-achievements/:index_number', authMiddleware, deleteNotableAchievement);

router.get('/applications', authMiddleware, getApplications);
router.post('/process-application', authMiddleware, processApplication);
router.get('/officials', authMiddleware, getOfficials);
router.get('/officials-kpi-summary', authMiddleware, getKpiSummary);
router.get('/officials/:TLOid/last-vacate-update', authMiddleware, getLastVacateUpdate);
router.get('/position-incumbents', authMiddleware, getPositionIncumbents);
router.get('/active-officials', authMiddleware, getActiveOfficials);
router.get('/unassigned-personnel', authMiddleware, getUnassignedPersonnel);
router.post('/add-unassigned-personnel', authMiddleware, createUnassignedPersonnel);
router.post('/register-personnel', authMiddleware, registerPersonnel);
router.post('/process-registration', authMiddleware, processRegistration);
router.post('/toggle-test-account', authMiddleware, toggleTestAccount);
router.post('/reassign-official', authMiddleware, memoryUpload.single('file'), reassignOfficial);
router.post('/admin-action', authMiddleware, adminAction);
router.post('/bulk-process-directory', authMiddleware, bulkProcessDirectory);
router.post('/bulk-process-achievements', authMiddleware, bulkProcessAchievements);
router.get('/cron-trigger', triggerCron);

export default router;
