import express from 'express';
import multer from 'multer';
import authMiddleware from '../middleware/authMiddleware.js';
import {
  getPlantillaItems,
  createPlantillaItem,
  updatePlantillaItem,
  deletePlantillaItem,
  importCfsPlantillaReport,
  getTloPlantillaRecords
} from '../controllers/cesPlantillaController.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/ces-plantilla', authMiddleware, getPlantillaItems);
router.post('/ces-plantilla', authMiddleware, createPlantillaItem);
router.post('/ces-plantilla/import', authMiddleware, upload.single('file'), importCfsPlantillaReport);
router.get('/ces-plantilla/tlo-plantilla', authMiddleware, getTloPlantillaRecords);
router.put('/ces-plantilla/:id', authMiddleware, updatePlantillaItem);
router.delete('/ces-plantilla/:id', authMiddleware, deletePlantillaItem);

export default router;
