import express from 'express';
import { getBinary } from '../controllers/binaryController.js';

const router = express.Router();

router.get('/:id', getBinary);

export default router;
