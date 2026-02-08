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

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const gameCode = urlParams.get('gameCode');
const playerId = urlParams.get('playerId');

if (!gameCode || !playerId) {
    alert("Missing game information");
    window.location.href = 'home.html';
}

// Game state
let currentGame = null;
let currentRound = 1;
let isAI = false;
let hasSubmitted = false;
let hasVoted = false;

// Add round indicator
const roundIndicator = document.createElement('div');
roundIndicator.className = 'round-indicator';
roundIndicator.innerHTML = 'Round <span id="roundNumber">1</span>/3';
document.body.prepend(roundIndicator);

// Listen to game state
const gameRef = ref(db, `games/${gameCode}`);
let gameListener;

gameListener = onValue(gameRef, (snapshot) => {
    const game = snapshot.val();
    
    if (!game) {
        alert('Game not found');
        window.location.href = 'home.html';
        return;
    }
    
    currentGame = game;
    currentRound = game.currentRound || 1;
    isAI = game.aiPlayer === playerId;
    
    // Update round display
    document.getElementById('roundNumber').textContent = currentRound;
    
    // Handle game phases
    if (game.status === 'playing') {
        handlePlayingPhase(game);
    } else if (game.status === 'finished') {
        showFinalResults(game);
    }
});

// Handle playing phase
function handlePlayingPhase(game) {
    const round = game.rounds?.[currentRound];
    if (!round) return;
    
    const submissions = round.submissions || {};
    const votes = round.votes || {};
    const results = round.results;
    
    // Show title
    document.getElementById('title').textContent = 'AI vs Humans';
    
    // Determine phase
    if (results) {
        showResults(game, round, results);
    } else if (Object.keys(votes).length > 0 || round.phase === 'voting') {
        showVoting(game, round, submissions, votes);
    } else {
        showSubmit(game, round, submissions);
    }
}

// Show submit phase
function showSubmit(game, round, submissions) {
    const wrapper = document.getElementById('wrapper');
    const playerAnswer = document.getElementById('playerAnswer');
    
    wrapper.textContent = round.prompt || 'Loading prompt...';
    playerAnswer.style.display = 'flex';
    
    // Check if already submitted
    if (submissions[playerId] && !isAI) {
        showWaitingState('Waiting for other players to submit...');
        playerAnswer.style.display = 'none';
    } else if (isAI) {
        showWaitingState('You are the AI! Waiting for others...');
        playerAnswer.style.display = 'none';
    }
}

// Submit answer handler
document.getElementById('playerAnswer').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (isAI || hasSubmitted) return;
    
    const answer = document.getElementById('input').value.trim();
    
    if (!answer) {
        alert('Please enter an answer');
        return;
    }
    
    const submitBtn = this.querySelector('input[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.value = 'Submitting...';
    
    try {
        const response = await fetch('/api/game/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gameCode,
                round: currentRound,
                playerId,
                answer
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to submit');
        }
        
        hasSubmitted = true;
        console.log('Answer submitted');
        showWaitingState('Answer submitted! Waiting for others...');
        this.style.display = 'none';
        
    } catch (err) {
        console.error('Error submitting:', err);
        alert('Failed to submit: ' + err.message);
        submitBtn.disabled = false;
        submitBtn.value = 'Submit Answer';
    }
});

// Show voting phase
function showVoting(game, round, submissions, votes) {
    const wrapper = document.getElementById('wrapper');
    const playerAnswer = document.getElementById('playerAnswer');
    
    wrapper.textContent = 'Who is the AI?';
    playerAnswer.style.display = 'none';
    
    // Check if already voted
    if (votes[playerId] && !isAI) {
        showWaitingState('Vote submitted! Waiting for others...');
        return;
    } else if (isAI) {
        showWaitingState('You are the AI! Waiting for votes...');
        return;
    }
    
    // Show answers for voting
    displayAnswersForVoting(game, submissions, votes[playerId]);
}

// Display answers for voting
function displayAnswersForVoting(game, submissions, selectedVote) {
    // Remove existing voting container
    let votingContainer = document.querySelector('.voting-container');
    if (votingContainer) {
        votingContainer.remove();
    }
    
    votingContainer = document.createElement('div');
    votingContainer.className = 'voting-container';
    
    // Create array and shuffle
    const answers = Object.entries(submissions).map(([id, answer]) => ({
        playerId: id,
        playerName: game.players[id]?.name || '???',
        answer: answer
    }));
    
    shuffleArray(answers);
    
    // Display each answer
    answers.forEach(item => {
        const card = document.createElement('div');
        card.className = 'answer-card';
        
        if (item.playerId === playerId) {
            card.style.opacity = '0.5';
            card.style.cursor = 'not-allowed';
        }
        
        if (selectedVote === item.playerId) {
            card.classList.add('selected');
        }
        
        card.innerHTML = `
            <div class="answer-player">${item.playerName}</div>
            <div class="answer-text">${item.answer}</div>
        `;
        
        card.addEventListener('click', () => voteForAnswer(item.playerId, card));
        
        votingContainer.appendChild(card);
    });
    
    document.body.appendChild(votingContainer);
}

// Vote for an answer
async function voteForAnswer(targetId, cardElement) {
    if (targetId === playerId) {
        alert('Cannot vote for yourself!');
        return;
    }
    
    if (hasVoted) return;
    
    // Visual feedback
    document.querySelectorAll('.answer-card').forEach(el => {
        el.classList.remove('selected');
    });
    cardElement.classList.add('selected');
    
    try {
        const response = await fetch('/api/game/vote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gameCode,
                round: currentRound,
                voterId: playerId,
                targetId
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to vote');
        }
        
        hasVoted = true;
        console.log('Vote submitted');
        showWaitingState('Vote submitted! Waiting for results...');
        document.querySelector('.voting-container').remove();
        
    } catch (err) {
        console.error('Error voting:', err);
        alert('Failed to vote: ' + err.message);
        cardElement.classList.remove('selected');
    }
}

// Show results
function showResults(game, round, results) {
    const wrapper = document.getElementById('wrapper');
    wrapper.textContent = `Round ${currentRound} Results`;
    
    document.getElementById('playerAnswer').style.display = 'none';
    document.querySelector('.voting-container')?.remove();
    
    // Create or update results container
    let resultsContainer = document.querySelector('.results-container');
    if (!resultsContainer) {
        resultsContainer = document.createElement('div');
        resultsContainer.className = 'results-container';
        document.body.appendChild(resultsContainer);
    }
    
    const aiPlayer = game.players[results.aiPlayerId];
    
    resultsContainer.innerHTML = `
        <div class="ai-reveal">
            <p>The AI was...</p>
            <h2>${aiPlayer?.name || '???'}</h2>
        </div>
        
        <div class="scores">
            <h3>Current Scores</h3>
            <div id="scoresContainer"></div>
        </div>
        
        <button id="nextRoundBtn" class="primary-btn">
            ${currentRound < 3 ? 'Next Round' : 'See Final Results'}
        </button>
    `;
    
    displayScores(game.players);
    
    // Next round button
    document.getElementById('nextRoundBtn').addEventListener('click', () => {
        hasSubmitted = false;
        hasVoted = false;
        document.getElementById('nextRoundBtn').disabled = true;
    });
}

// Display scores
function displayScores(players) {
    const container = document.getElementById('scoresContainer');
    if (!container) return;
    
    const sorted = Object.entries(players)
        .filter(([id, data]) => !data.isAI)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => (b.score || 0) - (a.score || 0));
    
    container.innerHTML = sorted.map((player, index) => `
        <div class="score-row ${index === 0 ? 'rank-1' : ''}">
            <span class="score-name">
                ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : ''} 
                ${player.name}
                ${player.id === playerId ? ' (You)' : ''}
            </span>
            <span class="score-value">${player.score || 0}</span>
        </div>
    `).join('');
}

// Show final results
function showFinalResults(game) {
    document.getElementById('title').textContent = 'Game Over!';
    document.getElementById('wrapper').textContent = '';
    document.getElementById('playerAnswer').style.display = 'none';
    document.querySelector('.voting-container')?.remove();
    document.querySelector('.results-container')?.remove();
    
    const finalContainer = document.createElement('div');
    finalContainer.className = 'results-container';
    finalContainer.style.textAlign = 'center';
    
    const winners = game.winners || [];
    const winnerNames = winners.map(id => game.players[id]?.name || '???').join(' & ');
    
    finalContainer.innerHTML = `
        <div class="ai-reveal" style="border-color: var(--accent);">
            <p style="font-size: 1.5rem;">🏆 Winner 🏆</p>
            <h2 style="color: var(--accent); font-size: 3rem;">${winnerNames}</h2>
            <p style="font-size: 1.2rem; margin-top: 1rem;">${game.winningScore || 0} points</p>
        </div>
        
        <div class="scores" style="margin-top: 2rem;">
            <h3>Final Standings</h3>
            <div id="finalScoresContainer"></div>
        </div>
        
        <p style="margin-top: 2rem; opacity: 0.7;">
            The AI was: <strong>${game.players[game.aiPlayer]?.name || '???'}</strong>
        </p>
        
        <button onclick="window.location.href='home.html'" class="primary-btn" style="margin-top: 2rem;">
            Play Again
        </button>
    `;
    
    document.body.appendChild(finalContainer);
    
    // Show final scores
    setTimeout(() => displayFinalScores(game.players), 100);
}

// Display final scores
function displayFinalScores(players) {
    const container = document.getElementById('finalScoresContainer');
    if (!container) return;
    
    const sorted = Object.entries(players)
        .filter(([id, data]) => !data.isAI)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => (b.score || 0) - (a.score || 0));
    
    container.innerHTML = sorted.map((player, index) => `
        <div class="score-row ${index === 0 ? 'rank-1' : ''}">
            <span class="score-name">
                ${index + 1}. ${player.name}
                ${player.id === playerId ? ' (You)' : ''}
            </span>
            <span class="score-value">${player.score || 0}</span>
        </div>
    `).join('');
}

// Show waiting state
function showWaitingState(message) {
    let waitingDiv = document.querySelector('.waiting');
    if (!waitingDiv) {
        waitingDiv = document.createElement('div');
        waitingDiv.className = 'waiting';
        document.body.appendChild(waitingDiv);
    }
    
    waitingDiv.innerHTML = `
        <div class="spinner"></div>
        <p>${message}</p>
    `;
}

// Utility functions
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Cleanup
window.addEventListener('beforeunload', () => {
    if (gameListener) {
        off(gameRef);
    }
});