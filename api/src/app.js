import express from 'express';
import cors from 'cors';
import path from 'path';
import compression from 'compression';
import authRoutes from './routes/authRoutes.js';
import thirdLevelRoutes from './routes/thirdLevelRoutes.js';
import { binaryRoutes } from './features/binary/index.js';
import requestContext from './middleware/requestContext.js';
import errorHandler from './middleware/errorHandler.js';

// The express app without side effects (no listen, no DB init, no cron) so tests can import it.
const app = express();

app.use(requestContext);
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) });
});

app.use('/api/auth', authRoutes);
app.use('/api/third-level', thirdLevelRoutes);
app.use('/api/binary', binaryRoutes);

app.use(errorHandler);

export default app;
