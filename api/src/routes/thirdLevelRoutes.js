import express from 'express';
import officialProfilingRoutes from './officialProfilingRoutes.js';
import officialsRegistryRoutes from './officialsRegistryRoutes.js';

const router = express.Router();

router.use(officialProfilingRoutes);
router.use(officialsRegistryRoutes);

export default router;
