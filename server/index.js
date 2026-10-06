import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import apiRouter from './routes/api.js';
import authRouter from './routes/auth.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', apiRouter);
app.use('/api/auth', authRouter);

// Base Route
app.get('/', (req, res) => {
  res.send('⚓ Aether Immersion Backend API is running!');
});

// Start Server & Connect Database
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[Express Server] API running at http://localhost:${PORT}`);
    console.log(`[Express Server] Health Check at http://localhost:${PORT}/api/health`);
    console.log(`[Express Server] Google Auth at http://localhost:${PORT}/api/auth/google`);
  });
};

startServer();
