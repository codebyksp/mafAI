import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, off } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBYz0Qq02wMXEscq4dZ4fJdD0Ii8RElEUw",
  authDomain: "hackathon-3c4b6.firebaseapp.com",
  databaseURL: "https://hackathon-3c4b6-default-rtdb.firebaseio.com",
  projectId: "hackathon-3c4b6",
  storageBucket: "hackathon-3c4b6.firebasestorage.app",
  messagingSenderId: "844064924386",
  appId: "1:844064924386:web:e924caed7a63efbe3df4bb",
  measurementId: "G-WXQML1M3VR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

document.addEventListener('DOMContentLoaded', function () {
    const urlParams = new URLSearchParams(window.location.search);
    const gameCode = urlParams.get('gameCode');
    const hostID = urlParams.get('hostID');

    if (!gameCode) {
        alert('No game code found');
        window.location.href = 'home.html';
        return;
    }

    // Create container structure
    document.body.innerHTML = `
        <div class="container">
            <h1 id="gameCode">Room Code</h1>
            <div class="code-display">${gameCode}</div>
            
            <div class="player-list">
                <h3>Players (<span id="playerCount">0</span>/8)</h3>
                <div id="playerListContainer"></div>
            </div>
            
            <div class="status-message">
                <p id="statusText">Waiting for players to join...</p>
                <p class="min-players">Minimum 3 players required</p>
            </div>
            
            <input id="startButton" type="submit" value="Start Game!" disabled>
        </div>
    `;

    const playerListContainer = document.getElementById('playerListContainer');
    const playerCount = document.getElementById('playerCount');
    const statusText = document.getElementById('statusText');
    const startButton = document.getElementById('startButton');

    // Listen to game state
    const gameRef = ref(db, `games/${gameCode}`);
    let gameListener;

    gameListener = onValue(gameRef, (snapshot) => {
        const game = snapshot.val();
        
        if (!game) {
            console.error('Game not found in Firebase:', gameCode);
            alert('Game not found. Please try creating a new game.');
            window.location.href = 'home.html';
            return;
        }

        console.log('Game data received:', game);

        // Check if game started
        if (game.status === 'playing') {
            console.log('Game started! Redirecting...');
            window.location.href = `game.html?gameCode=${gameCode}&playerId=${hostID}`;
            return;
        }

        // Update player list
        updatePlayerList(game.players, game.host);
        
        // Update player count
        const count = Object.keys(game.players || {}).length;
        playerCount.textContent = count;
        
        // Update status and button
        if (count >= 3) {
            startButton.disabled = false;
            statusText.textContent = 'Ready to start!';
            statusText.style.color = 'var(--accent)';
        } else {
            startButton.disabled = true;
            statusText.textContent = `Need ${3 - count} more player(s)`;
            statusText.style.color = 'var(--light)';
        }
    });

    // Update player list display
    function updatePlayerList(players, hostId) {
        if (!players) {
            playerListContainer.innerHTML = '<p style="text-align: center; opacity: 0.5;">No players yet...</p>';
            return;
        }

        playerListContainer.innerHTML = '';
        

        let count = 1;


        Object.entries(players).forEach(([id, player]) => {


            const playerDiv = document.createElement('div');
            playerDiv.className = 'player-item';
            
            if (id === hostId) {
                playerDiv.classList.add('host');
            }
            
            playerDiv.innerHTML = `
                <span class="player-name">${"player "+count || 'Player'}</span>
                ${id === hostId ? '<span class="player-badge">HOST</span>' : ''}
            `;
            
            count++
            playerListContainer.appendChild(playerDiv);
        });
    }

    // Start game button
    startButton.addEventListener('click', async function () {
        startButton.disabled = true;
        startButton.classList.add('loading');
        statusText.textContent = 'Starting game...';

        try {
            const response = await fetch('/api/game/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gameCode: gameCode })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to start game');
            }

            console.log('Game start request sent');
            // Firebase listener will handle redirect when status changes
            
        } catch (err) {
            console.error('Error starting game:', err);
            alert('Failed to start game: ' + err.message);
            startButton.disabled = false;
            startButton.classList.remove('loading');
            statusText.textContent = 'Ready to start!';
        }
    });

    // Cleanup
    window.addEventListener('beforeunload', () => {
        if (gameListener) {
            off(gameRef);
        }
    });
});