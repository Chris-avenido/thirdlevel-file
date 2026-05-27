import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import thirdLevelRoutes from './routes/thirdLevelRoutes.js';
import { initDB } from './config/db.js';

const app = express();
const port = process.env.THIRD_LEVEL_PORT || process.env.PORT || 3008;

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 [Fatal] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('🔥 [Fatal] Uncaught Exception:', err);
});

initDB();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/third-level', thirdLevelRoutes);

app.listen(port, () => {
  console.log(`🚀 Third Level API Service running on Port ${port}`);
});
