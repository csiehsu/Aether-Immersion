import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import { Player } from '../models/Player.js';
import { isDbConnected } from '../utils/dbHelper.js';

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Helper to decode JWT fallback if client ID is placeholder
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
    if (!player) {
      player = await Player.findOne({ googleId: null });
    }

    if (player) {
      player.googleId = googleUser.sub;
      player.email = googleUser.email;
      if (!player.isCharacterCreated) {
        player.name = googleUser.name;
      }
      player.pictureUrl = googleUser.picture;
      player.isLoggedIn = true;
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
        location: 'AZURE_BAY_PORT',
        locationEn: 'Azure Bay Port',
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
      await Player.updateMany({}, { $set: { isLoggedIn: false } });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
