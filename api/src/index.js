import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import thirdLevelRoutes from './routes/thirdLevelRoutes.js';
import binaryRoutes from './routes/binaryRoutes.js';
import { initDB } from './config/db.js';
import pool from './config/db.js';
import compression from 'compression';

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
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/third-level', thirdLevelRoutes);
app.use('/api/binary', binaryRoutes);

app.listen(port, () => {
  console.log(`🚀 Third Level API Service running on Port ${port}`);
});
