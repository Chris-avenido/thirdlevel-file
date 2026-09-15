import express from 'express';
import officialProfilingRoutes from './officialProfilingRoutes.js';
import officialsRegistryRoutes from './officialsRegistryRoutes.js';
import cesPlantillaRoutes from './cesPlantillaRoutes.js';

const router = express.Router();

router.use(officialProfilingRoutes);
router.use(officialsRegistryRoutes);
router.use(cesPlantillaRoutes);

export default router;
