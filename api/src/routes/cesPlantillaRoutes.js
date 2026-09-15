import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {
  getPlantillaItems,
  createPlantillaItem,
  updatePlantillaItem,
  deletePlantillaItem
} from '../controllers/cesPlantillaController.js';

const router = express.Router();

router.get('/ces-plantilla', authMiddleware, getPlantillaItems);
router.post('/ces-plantilla', authMiddleware, createPlantillaItem);
router.put('/ces-plantilla/:id', authMiddleware, updatePlantillaItem);
router.delete('/ces-plantilla/:id', authMiddleware, deletePlantillaItem);

export default router;
