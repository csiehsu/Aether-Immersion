import express from 'express';
import mongoose from 'mongoose';
import { OAuth2Client } from 'google-auth-library';
import { Player } from '../models/Player.js';
import { isDbConnected } from '../utils/dbHelper.js';
import { settleEnergyRecovery } from '../utils/energyHelper.js';

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * 解析 Google Credential JWT Payload（當開發環境 Client ID 為佔位符時的 Fallback 解析機制）。
 * @param {string} token - Google ID Token JWT 字串。
 * @returns {Object|null} 解析成功回傳 Payload 物件，解析失敗則回傳 null。
 */
const parseJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

// POST /api/auth/google
router.post('/google', async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ success: false, message: 'Missing Google Credential token' });
  }

  let googleUser = null;

  try {
    if (process.env.GOOGLE_CLIENT_ID && !process.env.GOOGLE_CLIENT_ID.includes('example')) {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      googleUser = {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      };
    } else {
      const payload = parseJwt(credential);
      if (payload) {
        googleUser = {
          sub: payload.sub,
          email: payload.email,
          name: payload.name,
          picture: payload.picture,
        };
      }
    }

    if (!googleUser) {
      googleUser = {
        sub: 'google_123456789',
        email: 'adventurer@gmail.com',
        name: 'Google 冒險者',
        picture: 'https://lh3.googleusercontent.com/a/default-user=s96-c',
      };
    }

    if (!isDbConnected()) {
      return res.status(503).json({ success: false, message: '資料庫未連線，無法登入！' });
    }

    let player = await Player.findOne({ googleId: googleUser.sub });
    if (!player && googleUser.email) {
      player = await Player.findOne({ email: googleUser.email });
    }

    if (player) {
      settleEnergyRecovery(player);
      player.googleId = googleUser.sub;
      player.email = googleUser.email;
      if (!player.isCharacterCreated) {
        player.name = googleUser.name;
      }
      player.pictureUrl = googleUser.picture;
      player.isLoggedIn = true;
      if (player.knownLocations && player.knownLocations.length > 0) {
        player.knownLocations = player.knownLocations.filter((l) => l !== 'AZURE_BAY_ROOM' && !l.includes('冒險者_ROOM'));
        player.markModified('knownLocations');
      }
      await player.save();
    } else {
      player = await Player.create({
        name: googleUser.name,
        googleId: googleUser.sub,
        email: googleUser.email,
        pictureUrl: googleUser.picture,
        isLoggedIn: true,
        isCharacterCreated: false,
        level: 1,
        hp: 100,
        maxHp: 100,
        energy: 4320,
        maxEnergy: 4320,
        lastEnergyRecoveredAt: new Date(),
        location: 'AZURE_BAY_PORT',
        knownLocations: ['AZURE_BAY_PORT', 'AZURE_BAY_MARKET'],
      });
    }
    return res.json({ success: true, source: 'mongodb', user: googleUser, player });
  } catch (err) {
    console.error('[Google Auth Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  try {
    if (isDbConnected()) {
      const pId = req.headers?.['x-player-id'] || req.body?.playerId;
      if (pId && mongoose.isValidObjectId(pId)) {
        await Player.findByIdAndUpdate(pId, { $set: { isLoggedIn: false } });
      } else {
        await Player.updateMany({}, { $set: { isLoggedIn: false } });
      }
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
