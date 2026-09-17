import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {
  getPositions,
  getFilterOptions,
  getPositionDetails,
  checkReferences,
  createPosition,
  updatePosition,
  deletePosition
} from '../controllers/tloPositionController.js';

const router = express.Router();

// Routes for /api/third-level/tlo-positions
router.get('/', authMiddleware, getPositions);
router.get('/options', authMiddleware, getFilterOptions);
router.get('/:id', authMiddleware, getPositionDetails);
router.get('/:id/references', authMiddleware, checkReferences);
router.post('/', authMiddleware, createPosition);
router.put('/:id', authMiddleware, updatePosition);
router.delete('/:id', authMiddleware, deletePosition);

export default router;
