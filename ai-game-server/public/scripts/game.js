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
let previousRound = 0;


gameListener = onValue(gameRef, (snapshot) => {
    const game = snapshot.val();
    if (!game) {
        console.error('Game not found in Firebase:', gameCode);
        alert('Game not found. Please try creating a new game.');
        window.location.href = 'home.html';
        return;
    }
    
    console.log('Game data received in game.js:', game);
    currentGame = game;
    const newRound = game.currentRound || 1;
    isAI = game.aiPlayer === playerId;
    
    // Check if round changed and clean up UI
    if (newRound !== previousRound && previousRound !== 0) {
        console.log(`Round changed from ${previousRound} to ${newRound}, cleaning up UI`);
        cleanupRoundUI();
    }
    previousRound = newRound;
    currentRound = newRound;
    
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
    const phase = round.phase || 'submitting';
    
    // Show title
    document.getElementById('title').textContent = 'AI vs Humans';
    
    // Determine phase - CRITICAL: Only show results when they're actually available
    if (results && results.calculatedAt) {
        // Results are fully calculated and available
        showResults(game, round, results);
    } else if (phase === 'voting' || (Object.keys(votes).length > 0 && !hasVoted)) {
        // Voting phase - show voting interface
        showVoting(game, round, submissions, votes);
    } else if (Object.keys(submissions).length > 0) {
        // Check if all submissions are in and we're waiting for votes
        const players = game.players || {};
        const aiPlayerId = game.aiPlayer;
        const humanIds = Object.keys(players).filter((pid) => !players[pid].isAI);
        const expectedIds = aiPlayerId ? [...humanIds, aiPlayerId] : [...humanIds];
        const allSubmitted = expectedIds.every((pid) => submissions[pid]);
        
        if (allSubmitted && phase !== 'voting') {
            // All submissions in but not yet voting - waiting for server to update phase
            showWaitingState('All answers submitted! Waiting for voting to begin...');
        } else if (allSubmitted && phase === 'voting') {
            // All submissions in and voting phase started
            showVoting(game, round, submissions, votes);
        } else {
            // Still waiting for submissions
            showSubmit(game, round, submissions);
        }
    } else {
        showSubmit(game, round, submissions);
    }
}

// Clean up UI when round changes
function cleanupRoundUI() {
    // Clear text box

    const inputField = document.getElementById('input');
    if (inputField) {
        inputField.value = '';
    }
    
    // Reset submit button state
    const submitBtn = document.querySelector('#playerAnswer input[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.value = 'Submit Answer';
    }
    
    // Clear any existing voting container
    const votingContainer = document.querySelector('.voting-container');
    if (votingContainer) {
        votingContainer.remove();
    }
    
    // Clear any existing results container
    const resultsContainer = document.querySelector('.results-container');
    if (resultsContainer) {
        resultsContainer.remove();
    }
    
    // Clear waiting state
    const waitingDiv = document.querySelector('.waiting');
    if (waitingDiv) {
        waitingDiv.remove();
    }
    
    // Reset player answer form display
    const playerAnswer = document.getElementById('playerAnswer');
    if (playerAnswer) {
        playerAnswer.style.display = 'flex';
    }


    window.location.reload();


}

// Show submit phase
function showSubmit(game, round, submissions) {
    
    document.querySelector('.waiting')?.remove();

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

        document.querySelector('.waiting')?.remove();


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



    console.log('Displaying answers for voting:', { game, submissions, selectedVote });
    
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
    
    console.log('Shuffled answers:', answers);
    
    // Display each answer
    answers.forEach(item => {
        const card = document.createElement('div');
        card.className = 'answer-card';
        card.dataset.playerId = item.playerId; // Store player ID as data attribute
        
        if (item.playerId === playerId) {
            card.style.opacity = '0.5';
            card.style.cursor = 'not-allowed';
            card.style.pointerEvents = 'none'; // Prevent clicking own answer
            console.log('Disabled own answer card for:', item.playerName);
        } else {
            // Enable clicking for other players' answers
            card.style.cursor = 'pointer';
            card.style.pointerEvents = 'auto'; // Ensure pointer events are enabled
            console.log('Enabled voting card for:', item.playerName);
        }
        
        if (selectedVote === item.playerId) {
            card.classList.add('selected');
        }
        
        card.innerHTML = `
            <div class="answer-player">${item.playerName}</div>
            <div class="answer-text">${item.answer}</div>
        `;
        
        votingContainer.appendChild(card);
    });
    
    // Add event delegation for voting container
    votingContainer.addEventListener('click', (e) => {
        const card = e.target.closest('.answer-card');
        if (!card) return;
        
        const targetId = card.dataset.playerId;
        if (!targetId) return;
        
        // Don't allow clicking own answer
        if (targetId === playerId) {
            alert('Cannot vote for yourself!');
            return;
        }
        
        console.log('Vote clicked for:', card.querySelector('.answer-player').textContent, 'ID:', targetId);
        voteForAnswer(targetId, card);
    });
    
    document.body.appendChild(votingContainer);




}

// Vote for an answer
async function voteForAnswer(targetId, cardElement) {

    
    console.log('Attempting to vote for:', targetId, 'from player:', playerId);
    
    if (targetId === playerId) {
        alert('Cannot vote for yourself!');
        return;
    }
    
    if (hasVoted) {
        console.log('Already voted, ignoring');
        return;
    }
    
    // Visual feedback
    document.querySelectorAll('.answer-card').forEach(el => {
        el.classList.remove('selected');
    });
    cardElement.classList.add('selected');
    
    try {
        console.log('Sending vote request to server...');
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
        
        console.log('Vote response status:', response.status);
        
        const data = await response.json();
        console.log('Vote response data:', data);
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to vote');
        }
        
        hasVoted = true;
        console.log('Vote submitted successfully');
        showWaitingState('Vote submitted! Waiting for results...');
        
        // Safely remove voting container
        const votingContainer = document.querySelector('.voting-container');
        if (votingContainer) {
            votingContainer.remove();
        }
        


    } catch (err) {
        console.error('Error voting:', err);
        alert('Failed to vote: ' + err.message);
        cardElement.classList.remove('selected');
    }


}

// Show results
function showResults(game, round, results) {

        document.querySelector('.waiting')?.remove();


    const wrapper = document.getElementById('wrapper');
    wrapper.textContent = `Round ${currentRound} Results`;
    
    document.getElementById('playerAnswer').style.display = 'none';
    document.querySelector('.voting-container')?.remove();
    
    // Clear any existing results container
    const existingResults = document.querySelector('.results-container');
    if (existingResults) {
        existingResults.remove();
    }
    
    // Create results container
    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'results-container';
    document.body.appendChild(resultsContainer);
    
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
        // Clear the results container when moving to next round
        resultsContainer.remove();
        hasSubmitted = false;
        hasVoted = false;
        document.getElementById('nextRoundBtn').disabled = true;
        
        // Clear the text box for the next round
        const inputField = document.getElementById('input');
        if (inputField) {
            inputField.value = '';
        }
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
    
    const urlParams = new URLSearchParams(window.location.search);
    const playerId = urlParams.get('playerId');


const winners = game.winners || [];

    let winnerNames = winners.map(id => game.players[id]?.name || '???').join(' & ');
    
    for(let i = 0; i<winners.length; i++){
    if(winners[i] == playerId){
        winnerNames = winnerNames + " (You)"
        document.getElementById('title').textContent = 'Winner!';
         document.getElementById('title').style.color = "yellow";
    }
    else{
        document.getElementById('title').textContent = 'Game Over!';

    }
}


    document.getElementById('wrapper').textContent = '';
    document.getElementById('playerAnswer').style.display = 'none';
    document.querySelector('.voting-container')?.remove();
    document.querySelector('.results-container')?.remove();
    
    const finalContainer = document.createElement('div');
    finalContainer.className = 'results-container';
    finalContainer.style.textAlign = 'center';
    
    
    finalContainer.innerHTML = `
        <div class="ai-reveal" style="border-color: var(--accent);">
            <p style="font-size: 1.5rem;">🏆 Winner 🏆</p>

            <h2 style="color: var(--accent); font-size: 3rem;">${winnerNames }</h2>
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


var count = 0;

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




