import express from 'express';
import officialProfilingRoutes from './officialProfilingRoutes.js';
import officialsRegistryRoutes from './officialsRegistryRoutes.js';
import cesPlantillaRoutes from './cesPlantillaRoutes.js';
import assignmentRoutes from './assignmentRoutes.js';
import tloPositionRoutes from './tloPositionRoutes.js';

const router = express.Router();

router.use(officialProfilingRoutes);
router.use(officialsRegistryRoutes);
router.use(cesPlantillaRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/tlo-positions', tloPositionRoutes);

export default router;
