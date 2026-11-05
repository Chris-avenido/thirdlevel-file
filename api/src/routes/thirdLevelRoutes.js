import express from 'express';
import officialProfilingRoutes from './officialProfilingRoutes.js';
import { notableAchievementsRoutes } from '../features/notable-achievements/index.js';
import officialsRegistryRoutes from './officialsRegistryRoutes.js';

const router = express.Router();

router.use(officialProfilingRoutes);
router.use(notableAchievementsRoutes);
router.use(officialsRegistryRoutes);

export default router;
