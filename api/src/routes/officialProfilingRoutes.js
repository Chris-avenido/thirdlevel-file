import express from 'express';
import multer from 'multer';
import authMiddleware from '../middleware/authMiddleware.js';
import {
  getByEmail,
  getCareerPath,
  getProfile,
  getVacancies,
  initializeProfile,
  submitApplication,
  updateProfile,
  uploadDocument,
  getNotableAchievements
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
router.get('/notable-achievements', authMiddleware, getNotableAchievements);
router.get('/:TLOid/career-path', authMiddleware, getCareerPath);

export default router;
