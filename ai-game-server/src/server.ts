import express, { Request, Response } from 'express';
import admin from 'firebase-admin';
import { GoogleGenAI } from "@google/genai";
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.database();

// Initialize Gemini v3
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Utility function to generate game code
function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Prompts for the game
const GAME_PROMPTS = [
  "What's the most embarrassing thing that happened to you in school?",
  "If you could have dinner with anyone, living or dead, who would it be and why?",
  "What's a skill you wish you had?"
];

// ==================== ENDPOINTS ====================

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Create a new game
app.post('/api/game/create', async (req: Request, res: Response) => {
  try {
    const { hostId } = req.body;
    if (!hostId) return res.status(400).json({ error: 'hostId is required' });

    const gameCode = generateCode();
    await db.ref(`games/${gameCode}`).set({
      status: 'lobby',
      host: hostId,
      players: {
        [hostId]: { name: 'Player-1', score: 0, isAI: false, joinedAt: Date.now() }
      },
      currentRound: 0,
      createdAt: Date.now()
    });

    console.log(`Game created: ${gameCode} by host: ${hostId}`);
    res.json({ gameCode, hostId });

  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// Join an existing game
app.post('/api/game/join', async (req: Request, res: Response) => {
  try {
    const { gameCode, playerId } = req.body;
    if (!gameCode || !playerId) return res.status(400).json({ error: 'gameCode and playerId are required' });

    const gameRef = db.ref(`games/${gameCode}`);
    const snapshot = await gameRef.once('value');
    if (!snapshot.exists()) return res.status(404).json({ error: 'Game not found' });

    const game = snapshot.val();
    if (game.status !== 'lobby') return res.status(400).json({ error: 'Game already started' });

    if (game.players[playerId]) return res.json({ success: true, message: 'Already in game' });

    const playerCount = Object.keys(game.players || {}).length;
    await gameRef.child(`players/${playerId}`).set({
      name: `Player-${playerCount + 1}`,
      score: 0,
      isAI: false,
      joinedAt: Date.now()
    });

    console.log(`Player ${playerId} joined game ${gameCode}`);
    res.json({ success: true });

  } catch (error) {
    console.error('Error joining game:', error);
    res.status(500).json({ error: 'Failed to join game' });
  }
});

// Start the game
app.post('/api/game/start', async (req: Request, res: Response) => {
  try {
    const { gameCode } = req.body;
    if (!gameCode) return res.status(400).json({ error: 'gameCode is required' });

    const gameRef = db.ref(`games/${gameCode}`);
    const snapshot = await gameRef.once('value');
    if (!snapshot.exists()) return res.status(404).json({ error: 'Game not found' });

    const game = snapshot.val();
    const playerIds = Object.keys(game.players);
    if (playerIds.length < 3) return res.status(400).json({ error: 'Need at least 3 players to start' });

    // Select AI
    const aiIndex = Math.floor(Math.random() * playerIds.length);
    const aiId = playerIds[aiIndex];
    await gameRef.child(`players/${aiId}/isAI`).set(true);

    // Start round 1
    await gameRef.update({
      status: 'playing',
      currentRound: 1,
      aiPlayer: aiId,
      rounds: { 1: { prompt: GAME_PROMPTS[0], startTime: Date.now(), submissions: {}, votes: {} } }
    });

    console.log(`Game ${gameCode} started. AI player: ${aiId}`);

    setTimeout(() => generateAIResponse(gameCode, 1, GAME_PROMPTS[0]), 2000);
    res.json({ success: true, aiId });

  } catch (error) {
    console.error('Error starting game:', error);
    res.status(500).json({ error: 'Failed to start game' });
  }
});

// Submit player answer
app.post('/api/game/submit', async (req: Request, res: Response) => {
  try {
    const { gameCode, round, playerId, answer } = req.body;
    if (!gameCode || !round || !playerId || !answer) return res.status(400).json({ error: 'Missing required fields' });

    await db.ref(`games/${gameCode}/rounds/${round}/submissions/${playerId}`).set(answer);
    console.log(`Player ${playerId} submitted answer for round ${round}`);
    res.json({ success: true });

  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).json({ error: 'Failed to submit answer' });
  }
});

// Submit vote
app.post('/api/game/vote', async (req: Request, res: Response) => {
  try {
    const { gameCode, round, voterId, targetId } = req.body;
    if (!gameCode || !round || !voterId || !targetId) return res.status(400).json({ error: 'Missing required fields' });

    await db.ref(`games/${gameCode}/rounds/${round}/votes/${voterId}`).set(targetId);
    console.log(`Player ${voterId} voted for ${targetId} in round ${round}`);

    const gameSnapshot = await db.ref(`games/${gameCode}`).once('value');
    const game = gameSnapshot.val();
    const players = game.players;
    const votes = game.rounds[round].votes || {};

    if (Object.keys(votes).length === Object.keys(players).length) {
      console.log(`All votes received for round ${round}. Calculating scores...`);
      await calculateRoundScores(gameCode, round);
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Error submitting vote:', error);
    res.status(500).json({ error: 'Failed to submit vote' });
  }
});

// ==================== AI LOGIC ====================

async function generateAIResponse(gameCode: string, round: number, prompt: string) {
  const fallbacks = [
    "honestly, probably just hanging out with my friends",
    "idk maybe pizza lol, i know thats basic",
    "probably when i tripped in the hallway in front of everyone"
  ];

  const systemPrompt = `You are playing a party game where you must pretend to be a human player. 
Your goal is to blend in and NOT be detected as AI.

CRITICAL INSTRUCTIONS:
- Answer like a casual human friend would
- Keep it SHORT (1-2 sentences max)
- Use conversational language: "lol", "honestly", "idk", "probably"
- Be specific but imperfect
- Minor grammar mistakes are OK
- Show personality and emotion
- Avoid being too formal

Prompt: ${prompt}

Your casual human answer:`;

  try {
    const result = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: systemPrompt
    });
    if (!result.text) {
      throw new Error('No text content in AI response');
    }
    const aiAnswer = result.text.trim();

    const gameSnapshot = await db.ref(`games/${gameCode}`).once('value');
    const aiPlayerId = gameSnapshot.val().aiPlayer;

    await db.ref(`games/${gameCode}/rounds/${round}/submissions/${aiPlayerId}`).set(aiAnswer);
    console.log(`AI submitted answer for round ${round}: "${aiAnswer}"`);

  } catch (error: any) {
    if (error.status === 429 && error.errorDetails?.[2]?.retryDelay) {
      const retryAfter = parseFloat(error.errorDetails[2].retryDelay.replace('s', '')) * 1000;
      console.log(`Rate limited by Gemini API. Retrying in ${retryAfter / 1000}s...`);
      setTimeout(() => generateAIResponse(gameCode, round, prompt), retryAfter);
      return;
    }

    console.warn('Gemini API failed or quota exceeded. Using fallback response.');
    const gameSnapshot = await db.ref(`games/${gameCode}`).once('value');
    const aiPlayerId = gameSnapshot.val().aiPlayer;

    await db.ref(`games/${gameCode}/rounds/${round}/submissions/${aiPlayerId}`)
      .set(fallbacks[round - 1] || "not sure tbh");

    console.log(`AI submitted fallback answer for round ${round}`);
  }
}

// ==================== SCORING LOGIC ====================

async function calculateRoundScores(gameCode: string, round: number) {
  try {
    const gameRef = db.ref(`games/${gameCode}`);
    const snapshot = await gameRef.once('value');
    const game = snapshot.val();

    const aiPlayerId = game.aiPlayer;
    const votes = game.rounds[round].votes;
    const players = game.players;

    let aiPoints = 0;
    const roundScores: { [key: string]: number } = {};

    for (const playerId of Object.keys(players)) roundScores[playerId] = 0;

    for (const [voterId, targetId] of Object.entries(votes) as [string, string][]) {
      if (targetId === aiPlayerId) roundScores[voterId] += 100;
      else aiPoints += 50;

      roundScores[voterId] += 10; // participation point
    }

    roundScores[aiPlayerId] += aiPoints;

    const updates: { [key: string]: any } = {};
    for (const [playerId, points] of Object.entries(roundScores)) {
      const currentScore = players[playerId].score || 0;
      updates[`players/${playerId}/score`] = currentScore + points;
    }

    updates[`rounds/${round}/results`] = {
      aiPlayerId,
      aiPointsEarned: aiPoints,
      votesForAI: Object.values(votes).filter(v => v === aiPlayerId).length,
      calculatedAt: Date.now()
    };

    await gameRef.update(updates);

    console.log(`Round ${round} scores calculated. AI earned ${aiPoints} points.`);

    if (round < 3) {
      const nextRound = round + 1;
      await gameRef.update({
        currentRound: nextRound,
        [`rounds/${nextRound}`]: { prompt: GAME_PROMPTS[nextRound - 1], startTime: Date.now(), submissions: {}, votes: {} }
      });
      console.log(`Starting round ${nextRound}`);
      setTimeout(() => generateAIResponse(gameCode, nextRound, GAME_PROMPTS[nextRound - 1]), 2000);
    } else {
      await gameRef.update({ status: 'finished', endedAt: Date.now() });
      console.log(`Game ${gameCode} finished!`);
    }

  } catch (error) {
    console.error('Error calculating scores:', error);
  }
}

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Firebase connected to: ${process.env.FIREBASE_DATABASE_URL}`);
  console.log(`Gemini API configured`);
});
