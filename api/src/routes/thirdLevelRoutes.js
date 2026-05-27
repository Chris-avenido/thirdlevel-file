import express from 'express';
import multer from 'multer';
import authMiddleware from '../middleware/authMiddleware.js';
import {
  initializeProfile,
  getByEmail,
  uploadDocument,
  getProfile,
  updateProfile,
  submitApplication,
  getVacancies,
  getApplications,
  processApplication,
  getOfficials,
  getCareerPath,
  getPositionIncumbents,
  getActiveOfficials,
  adminAction
} from '../controllers/thirdLevelController.js';

const router = express.Router();
const memoryUpload = multer({ storage: multer.memoryStorage() });

router.post('/initialize', initializeProfile);
router.get('/by-email', authMiddleware, getByEmail);
router.post('/:TLOid/upload/:docType', authMiddleware, memoryUpload.single('file'), uploadDocument);
router.get('/:TLOid/profile', authMiddleware, getProfile);
router.put('/:TLOid/profile', authMiddleware, updateProfile);
router.post('/submit-application', authMiddleware, submitApplication);
router.get('/vacancies', authMiddleware, getVacancies);
router.get('/applications', authMiddleware, getApplications);
router.post('/process-application', authMiddleware, processApplication);
router.get('/officials', authMiddleware, getOfficials);
router.get('/:TLOid/career-path', authMiddleware, getCareerPath);
router.get('/position-incumbents', authMiddleware, getPositionIncumbents);
router.get('/active-officials', authMiddleware, getActiveOfficials);
router.post('/admin-action', authMiddleware, adminAction);

export default router;
