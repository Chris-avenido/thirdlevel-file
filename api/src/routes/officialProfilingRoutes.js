import express from 'express';
import multer from 'multer';
import authMiddleware from '../middleware/authMiddleware.js';
import {
  getByEmail,
  checkProfilingEmail,
  getCareerPath,
  getProfile,
  getVacancies,
  initializeProfile,
  submitApplication,
  updateProfile,
  uploadDocument,
  getNotableAchievements,
  getPositions,
  getActiveAssignments
} from '../controllers/thirdLevelController.js';
import {
  getVacancyApplicantProfile,
  updateVacancyApplicantProfile,
  applyVacancy,
  uploadVacancyDocument,
  submitVacancyApplication,
  getMyVacancyApplications,
  getVacancyApplicationById
} from '../controllers/vacancyApplicantController.js';

const router = express.Router();
const memoryUpload = multer({ storage: multer.memoryStorage() });

router.post('/initialize', initializeProfile);
router.get('/by-email', authMiddleware, getByEmail);
router.get('/check-email', authMiddleware, checkProfilingEmail);
router.post('/:TLOid/upload/:docType', authMiddleware, memoryUpload.single('file'), uploadDocument);
router.get('/:TLOid/profile', authMiddleware, getProfile);
router.get('/:TLOid/active-assignments', authMiddleware, getActiveAssignments);
router.put('/:TLOid/profile', authMiddleware, updateProfile);
router.get('/submit-application', authMiddleware, submitApplication);
router.post('/submit-application', authMiddleware, submitApplication);
router.get('/vacancies', authMiddleware, getVacancies);
router.get('/vacancy-applicant/profile', authMiddleware, getVacancyApplicantProfile);
router.put('/vacancy-applicant/profile', authMiddleware, updateVacancyApplicantProfile);
router.post('/vacancy-applicant/apply', authMiddleware, applyVacancy);
router.post('/vacancy-applicant/upload-document', authMiddleware, memoryUpload.single('file'), uploadVacancyDocument);
router.post('/vacancy-applicant/application', authMiddleware, submitVacancyApplication);
router.get('/vacancy-applicant/applications', authMiddleware, getMyVacancyApplications);
router.get('/vacancy-applicant/application/:id', authMiddleware, getVacancyApplicationById);
router.get('/positions', authMiddleware, getPositions);
router.get('/notable-achievements', authMiddleware, getNotableAchievements);
router.get('/:TLOid/career-path', authMiddleware, getCareerPath);

export default router;
