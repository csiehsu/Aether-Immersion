import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import apiRouter from './routes/api.js';
import authRouter from './routes/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, '../dist');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', apiRouter);
app.use('/api/auth', authRouter);

// 前端靜態檔案託管 (若已打包 dist 目錄)
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA Fallback: 任何未被 /api 攔截的 GET 請求均回傳 index.html
  app.get('{*path}', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // 開發階段未執行打包時的基礎健康提示
  app.get('/', (req, res) => {
    res.send('⚓ Aether Immersion Backend API is running!');
  });
}

/**
 * 啟動 Express 伺服器並嘗試連線至 MongoDB 資料庫。
 * @returns {Promise<void>}
 */
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[Express Server] API running at http://localhost:${PORT}`);
    console.log(`[Express Server] Health Check at http://localhost:${PORT}/api/health`);
    console.log(`[Express Server] Google Auth at http://localhost:${PORT}/api/auth/google`);
  });
};

startServer();
