# Backend Setup Instructions

## Prerequisites
- Node.js 18+ installed
- Firebase project created
- Gemini API key obtained

## Quick Setup (5 minutes)

### 1. Install Dependencies
```bash
npm install
```

### 2. Get Firebase Service Account Key
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings → Service Accounts
4. Click "Generate New Private Key"
5. Save the JSON file as `serviceAccountKey.json` in the root of this project

### 3. Enable Firebase Realtime Database
1. In Firebase Console, click "Realtime Database" in the left menu
2. Click "Create Database"
3. Choose a location
4. Start in **test mode** (for hackathon - change for production!)
5. Copy your database URL (e.g., `https://your-project-default-rtdb.firebaseio.com`)

### 4. Get Gemini API Key
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Create API Key"
3. Copy the key

### 5. Configure Environment Variables
```bash
cp .env.example .env
```

Edit `.env` and add your values:
```env
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
GEMINI_API_KEY=your_actual_api_key_here
```

### 6. Start Development Server
```bash
npm run dev
```

You should see:
```
Server running on http://localhost:3000
Firebase connected to: https://your-project-default-rtdb.firebaseio.com
Gemini API configured
```

### 7. Test the API
```bash
# Health check
curl http://localhost:3000/api/health

# Create a game
curl -X POST http://localhost:3000/api/game/create \
  -H "Content-Type: application/json" \
  -d '{"hostId": "test-user-1"}'
```

## File Structure
```
ai-game-server/
├── src/
│   └── server.ts          # Main server file
├── serviceAccountKey.json # Firebase credentials (gitignored)
├── .env                   # Environment variables (gitignored)
├── .env.example          # Template for .env
├── package.json
├── tsconfig.json
└── nodemon.json
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run production build

## Troubleshooting

### "Cannot find module 'serviceAccountKey.json'"
- Make sure you downloaded the Firebase service account key
- Save it as `serviceAccountKey.json` in the project root

### "Firebase permission denied"
- Go to Firebase Console → Realtime Database → Rules
- Set to test mode temporarily:
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

### "Gemini API error"
- Check your API key is correct
- Verify you have quota remaining
- Fallback responses will be used if Gemini fails

### Port 3000 already in use
- Change PORT in .env file
- Or kill the process using port 3000

## Next Steps

1. Backend is running
2. → Set up frontend React app
3. → Connect frontend to backend
4. → Test full game flow
5. → Deploy!

## Deployment (Later)

### Option 1: Render
1. Connect GitHub repo
2. Add environment variables in dashboard
3. Deploy!

### Option 2: Railway
1. Connect GitHub repo  
2. Add environment variables
3. Deploy!

### Don't forget to:
- Set Firebase rules to production mode
- Add CORS whitelist for your frontend domain
- Use environment variables for all secrets