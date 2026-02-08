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

//going to main page

import path from 'path';

// Serve frontend files
app.use(express.static(path.join(__dirname, '../public')));


app.get('/', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../public/home.html'));
});


// Initialize Gemini
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
        if (!hostId) {
            return res.status(400).json({ error: 'hostId is required' });
        }

        const gameCode = generateCode();
        
        await db.ref(`games/${gameCode}`).set({
            status: 'lobby',
            host: hostId,
            players: {
                [hostId]: { 
                    name: 'Player-1', 
                    score: 0, 
                    isAI: false, 
                    joinedAt: Date.now() 
                }
            },
            currentRound: 0,
            createdAt: Date.now()
        });

        // ✅ VERIFY the write succeeded
        const snapshot = await db.ref(`games/${gameCode}`).once('value');
        if (!snapshot.exists()) {
            throw new Error('Database write failed');
        }

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
    
    if (!gameCode || !playerId) {
      return res.status(400).json({ error: 'gameCode and playerId are required' });
    }

    const gameRef = db.ref(`games/${gameCode}`);
    const snapshot = await gameRef.once('value');
    
    if (!snapshot.exists()) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = snapshot.val();
    
    if (game.status !== 'lobby') {
      return res.status(400).json({ error: 'Game already started' });
    }

    // Check if player already in game
    if (game.players[playerId]) {
      return res.json({ success: true, message: 'Already in game' });
    }

    const playerCount = Object.keys(game.players || {}).length;
    
    // Limit max players (optional)
    if (playerCount >= 8) {
      return res.status(400).json({ error: 'Game is full (max 8 players)' });
    }

    await gameRef.child(`players/${playerId}`).set({
      name: `Player-${playerCount + 1}`,
      score: 0,
      isAI: false,
      joinedAt: Date.now()
    });

    console.log(`Player ${playerId} joined game ${gameCode} (${playerCount + 1} total players)`);
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
    if (!gameCode) {
      return res.status(400).json({ error: 'gameCode is required' });
    }

        console.log(`Attempting to start game ${gameCode}...`);

    const gameRef = db.ref(`games/${gameCode}`);
    const snapshot = await gameRef.once('value');
    
    if (!snapshot.exists()) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = snapshot.val();

    // Prevent double-start
    if (game.status !== 'lobby') {
      return res.status(400).json({ error: 'Game already started' });
    }
    if (game.aiPlayer) {
      return res.status(400).json({ error: 'AI already created for this game' });
    }

    // Require at least 3 HUMAN players before adding the AI
    const players = game.players || {};
    const humanIds = Object.keys(players).filter((pid) => !players[pid].isAI);
    if (humanIds.length < 3) {
      return res.status(400).json({ error: 'Need at least 3 human players to start' });
    }

    // Create a NEW dedicated AI player (not hijacking a human)
    const aiId = `ai-${Date.now()}`;
    const now = Date.now();

    // Create AI + start round in one update
    await gameRef.update({
      [`players/${aiId}`]: {
        name: '???',
        score: 0,
        isAI: true,
        joinedAt: now
      },
      status: 'playing',
      currentRound: 1,
      aiPlayer: aiId,
      rounds: {
        1: {
          prompt: GAME_PROMPTS[0],
          startTime: now,
          phase: 'submitting',
          submissions: {},
          votes: {}
        }
      }
    });

    console.log(`Game ${gameCode} started! AI player: ${aiId} (${humanIds.length} human players)`);

    // Trigger AI response after a short delay
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
    
    if (!gameCode || !round || !playerId || !answer) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate answer length
    if (typeof answer !== 'string' || answer.trim().length === 0) {
      return res.status(400).json({ error: 'Answer must be a non-empty string' });
    }

    if (answer.length > 500) {
      return res.status(400).json({ error: 'Answer too long (max 500 characters)' });
    }

    const gameRef = db.ref(`games/${gameCode}`);
    const snapshot = await gameRef.once('value');
    
    if (!snapshot.exists()) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = snapshot.val();
    
    // Verify player exists and round is current
    if (!game.players[playerId]) {
      return res.status(400).json({ error: 'Player not in game' });
    }

    if (game.currentRound !== round) {
      return res.status(400).json({ error: 'Invalid round' });
    }

    const roundRef = db.ref(`games/${gameCode}/rounds/${round}`);
    await roundRef.child(`submissions/${playerId}`).set(answer.trim());
    
    console.log(`Player ${playerId} submitted answer for round ${round}`);

    // Check if all expected submissions are in (humans + AI)
    const players = game.players || {};
    const aiPlayerId = game.aiPlayer;
    const submissions = game.rounds?.[round]?.submissions || {};
    const humanIds = Object.keys(players).filter((pid) => !players[pid].isAI);

    // Add the current submission to check
    submissions[playerId] = answer.trim();

    // Expect: all humans + the AI submission
    const expectedIds = aiPlayerId ? [...humanIds, aiPlayerId] : [...humanIds];
    const allSubmitted = expectedIds.every((pid) => submissions[pid]);

    // Flip phase to voting once when complete
    const phase = game.rounds?.[round]?.phase || 'submitting';
    if (phase === 'submitting' && allSubmitted) {
      await roundRef.update({
        phase: 'voting',
        voteStartTime: Date.now()
      });
      console.log(`Round ${round}: all submissions received. Voting is now OPEN.`);
    }

    // Return useful info to client
    const newPhase = allSubmitted ? 'voting' : phase;
    res.json({
      success: true,
      phase: newPhase,
      submissionsReceived: Object.keys(submissions).length,
      submissionsRequired: expectedIds.length
    });

  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).json({ error: 'Failed to submit answer' });
  }
});

// Submit vote
app.post('/api/game/vote', async (req: Request, res: Response) => {
  try {
    const { gameCode, round, voterId, targetId } = req.body;
    
    if (!gameCode || !round || !voterId || !targetId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const gameRef = db.ref(`games/${gameCode}`);
    const snapshot = await gameRef.once('value');
    
    if (!snapshot.exists()) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = snapshot.val();
    const aiPlayerId = game.aiPlayer;

    // PREVENT AI FROM VOTING
    if (voterId === aiPlayerId) {
      return res.status(400).json({ error: 'AI cannot vote' });
    }

    // Verify both players exist
    if (!game.players[voterId] || !game.players[targetId]) {
      return res.status(400).json({ error: 'Invalid player ID' });
    }

    // Prevent self-voting
    if (voterId === targetId) {
      return res.status(400).json({ error: 'Cannot vote for yourself' });
    }

    if (game.currentRound !== round) {
      return res.status(400).json({ error: 'Invalid round' });
    }

    await db.ref(`games/${gameCode}/rounds/${round}/votes/${voterId}`).set(targetId);
    
    console.log(`Player ${voterId} voted for ${targetId} in round ${round}`);

    // Check if all HUMAN votes are in (AI doesn't vote)
    const votes = game.rounds[round].votes || {};
    const humanPlayerIds = Object.keys(game.players).filter(id => !game.players[id].isAI);
    
    // Include current vote
    const allVotes = { ...votes, [voterId]: targetId };
    const voteCount = Object.keys(allVotes).length;

    console.log(`Votes: ${voteCount}/${humanPlayerIds.length} humans have voted`);

    if (voteCount === humanPlayerIds.length) {
      console.log(`All human votes received for round ${round}. Calculating scores...`);
      await calculateRoundScores(gameCode, round);
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Error submitting vote:', error);
    res.status(500).json({ error: 'Failed to submit vote' });
  }
});

// Get game state (useful for debugging)
app.get('/api/game/:gameCode', async (req: Request, res: Response) => {
  try {
    const { gameCode } = req.params;
    const snapshot = await db.ref(`games/${gameCode}`).once('value');
    
    if (!snapshot.exists()) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json(snapshot.val());
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
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
- Minor grammar mistakes are OK and actually help you blend in
- Show personality and emotion
- Avoid being too formal or eloquent

GOOD examples:
- "probably my dog lol, he's always happy to see me"
- "honestly idk, maybe learn piano? always wanted to"
- "oh man, fell asleep in math class once and the teacher called on me lmao"

BAD examples (too AI-like):
- "I would choose to have dinner with Leonardo da Vinci because his contributions to art..."
- "An embarrassing moment was when I tripped during the school assembly."

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

    let aiAnswer = result.text.trim();
    
    // Validate answer length
    if (aiAnswer.length > 500) {
      console.warn('AI response too long, truncating...');
      aiAnswer = aiAnswer.substring(0, 500);
    }

    const gameSnapshot = await db.ref(`games/${gameCode}`).once('value');
    
    if (!gameSnapshot.exists()) {
      console.error('Game not found when AI tried to submit');
      return;
    }

    const aiPlayerId = gameSnapshot.val().aiPlayer;

    await db.ref(`games/${gameCode}/rounds/${round}/submissions/${aiPlayerId}`).set(aiAnswer);
    
    console.log(`AI submitted answer for round ${round}: "${aiAnswer}"`);

  } catch (error: any) {
    // Handle rate limiting with retry
    if (error.status === 429 && error.errorDetails?.[2]?.retryDelay) {
      const retryAfter = parseFloat(error.errorDetails[2].retryDelay.replace('s', '')) * 1000;
      console.log(`Rate limited by Gemini API. Retrying in ${retryAfter / 1000}s...`);
      setTimeout(() => generateAIResponse(gameCode, round, prompt), retryAfter);
      return;
    }

    console.warn('Gemini API failed. Using fallback response.');
    console.error('Error details:', error.message);

    try {
      const gameSnapshot = await db.ref(`games/${gameCode}`).once('value');
      
      if (!gameSnapshot.exists()) {
        console.error('Game not found for fallback');
        return;
      }

      const aiPlayerId = gameSnapshot.val().aiPlayer;

      await db.ref(`games/${gameCode}/rounds/${round}/submissions/${aiPlayerId}`)
        .set(fallbacks[round - 1] || "not sure tbh");

      console.log(`AI submitted fallback answer for round ${round}`);
    } catch (fallbackError) {
      console.error('Critical error: Could not submit fallback answer:', fallbackError);
    }
  }
}

// ==================== SCORING LOGIC ====================

async function calculateRoundScores(gameCode: string, round: number) {
  try {
    const gameRef = db.ref(`games/${gameCode}`);
    const snapshot = await gameRef.once('value');
    
    if (!snapshot.exists()) {
      console.error('Game not found during score calculation');
      return;
    }

    const game = snapshot.val();
    const aiPlayerId = game.aiPlayer;
    const votes = game.rounds[round].votes || {};
    const players = game.players;

    const roundScores: { [key: string]: number } = {};

    // Initialize round scores for ALL players (including AI at 0)
    for (const playerId of Object.keys(players)) {
      roundScores[playerId] = 0;
    }

    // NEW SCORING SYSTEM:
    // - Players compete against each other, NOT against AI
    // - +100 pts for correctly guessing AI
    // - +50 pts for fooling another player (when they vote for you)
    // - AI does NOT get points
    // - No participation points

    for (const [voterId, targetId] of Object.entries(votes) as [string, string][]) {
      // Skip if AI somehow voted (shouldn't happen but safety check)
      if (voterId === aiPlayerId) continue;

      // If voter correctly identified the AI
      if (targetId === aiPlayerId) {
        roundScores[voterId] += 100;
      } else {
        // Voter voted for another human player
        // Give the VOTED-FOR player +50 points (they fooled someone)
        if (targetId !== aiPlayerId) {
          roundScores[targetId] += 50;
        }
      }
    }

    // AI score stays at 0 - they don't accumulate points

    // Update all player scores in database
    const updates: { [key: string]: any } = {};
    for (const [playerId, points] of Object.entries(roundScores)) {
      const currentScore = players[playerId].score || 0;
      updates[`players/${playerId}/score`] = currentScore + points;
    }

    // Store round results
    const votesForAI = Object.values(votes).filter(v => v === aiPlayerId).length;
    updates[`rounds/${round}/results`] = {
      aiPlayerId,
      votesForAI: votesForAI,
      totalVotes: Object.keys(votes).length,
      calculatedAt: Date.now()
    };

    await gameRef.update(updates);

    // Detailed logging
    const scoreSummary = Object.entries(roundScores)
      .filter(([playerId]) => !players[playerId].isAI) // Only show human scores
      .map(([playerId, points]) => {
        const name = players[playerId]?.name || playerId;
        const totalScore = (players[playerId]?.score || 0) + points;
        return `${name}: +${points} (total ${totalScore})`;
      })
      .join(' | ');

    console.log(`Round ${round} scores calculated.`);
    console.log(`${votesForAI}/${Object.keys(votes).length} players correctly identified AI`);
    console.log(`Scores: ${scoreSummary}`);

    // Move to next round or end game
    if (round < 3) {
      const nextRound = round + 1;
      
      await gameRef.update({
        currentRound: nextRound,
        [`rounds/${nextRound}`]: {
          prompt: GAME_PROMPTS[nextRound - 1],
          startTime: Date.now(),
          phase: 'submitting',
          submissions: {},
          votes: {}
        }
      });

      console.log(`Starting round ${nextRound}`);

      // Trigger AI response for next round
      setTimeout(() => {
        generateAIResponse(gameCode, nextRound, GAME_PROMPTS[nextRound - 1]);
      }, 2000);

    } else {
      // Game over - calculate winner(s) among HUMAN players only
      const finalSnapshot = await gameRef.once('value');
      const finalGame = finalSnapshot.val();
      const finalPlayers = finalGame.players;

      // Find winner(s) among HUMAN players only
      let maxScore = -1;
      const winners: string[] = [];

      for (const [playerId, playerData] of Object.entries(finalPlayers) as [string, any][]) {
        // Skip AI from winner calculation
        if (playerData.isAI) continue;

        const score = playerData.score || 0;
        if (score > maxScore) {
          maxScore = score;
          winners.length = 0; // Clear array
          winners.push(playerId);
        } else if (score === maxScore) {
          winners.push(playerId);
        }
      }

      await gameRef.update({
        status: 'finished',
        endedAt: Date.now(),
        winners: winners,
        winningScore: maxScore
      });

      console.log(`Game ${gameCode} finished!`);
      console.log(`Winner(s): ${winners.map(id => finalPlayers[id].name).join(', ')}`);
      console.log(`Winning score: ${maxScore} points`);
    }

  } catch (error) {
    console.error('Error calculating scores:', error);
  }
}

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log('');
  console.log('================================');
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Firebase: ${process.env.FIREBASE_DATABASE_URL?.split('.')[0].split('//')[1]}`);
  console.log(`Gemini API: Configured`);
  console.log('================================');
  console.log('');
});