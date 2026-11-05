import express from 'express';
import { officialProfilingRoutes } from '../features/official-profiling/index.js';
import { notableAchievementsRoutes } from '../features/notable-achievements/index.js';
import { officialsRegistryRoutes } from '../features/officials-registry/index.js';

const router = express.Router();

router.use(officialProfilingRoutes);
router.use(notableAchievementsRoutes);
router.use(officialsRegistryRoutes);

export default router;
