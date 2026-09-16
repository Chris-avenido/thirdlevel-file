import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {
  getAssignments,
  getVacantPositions,
  getOfficialsForAssignment,
  createAssignment,
  deactivateAssignment,
  updateAssignment
} from '../controllers/assignmentController.js';

const router = express.Router();

router.get('/', authMiddleware, getAssignments);
router.get('/vacant-positions', authMiddleware, getVacantPositions);
router.get('/officials', authMiddleware, getOfficialsForAssignment);
router.post('/', authMiddleware, createAssignment);
router.put('/:id', authMiddleware, updateAssignment);
router.patch('/:id/deactivate', authMiddleware, deactivateAssignment);

export default router;
