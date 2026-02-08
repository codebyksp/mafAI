
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-database.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-analytics.js";

// Your Firebase config
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

var roundNumber = 1;



// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);

// Listen to prompt

const urlParams = new URLSearchParams(window.location.search);
const gameCode = urlParams.get('gameCode');
const playerId = urlParams.get('playerId');


function listenToPrompt(gameCode) {
    const promptRef = ref(db, `games/${gameCode}/rounds/${roundNumber}/prompt`);
    onValue(promptRef, (snapshot) => {
        const prompt = snapshot.val();
        if (prompt) {
            console.log("New prompt received:", prompt);
            const wrapper = document.getElementById('wrapper');
            if (wrapper) wrapper.innerText = prompt;
        }
    });
}

function listenToVoteTime(gameCode) {
    const voteRef = ref(db, `games/${gameCode}/rounds/${roundNumber}/voteStartTime`);
    onValue(voteRef, (snapshot) => {
        const voteTime = snapshot.val();
        if (voteTime) {
            console.log("Vote Time");

            //send to voting page with round number game code and player id

            window.location.href = `vote.html?gameCode=${encodeURIComponent(gameCode)}&playerId=${encodeURIComponent(playerId)}&roundNumber=${roundNumber}`;

            const wrapper = document.getElementById('wrapper');
            if (wrapper) wrapper.innerText = prompt;
        }
    });
}


document.addEventListener('DOMContentLoaded', () => {

    const urlParams = new URLSearchParams(window.location.search);
    const gameCode = urlParams.get('gameCode');
    const playerId = urlParams.get('playerId');


    if (!gameCode || !playerId) {
        alert("Fatal Error");
        window.location.href = 'home.html'; // Redirect back to home
    }
    else {
        listenToPrompt(gameCode);
        listenToVoteTime(gameCode);
    }
    


});



document.getElementById("playerAnswerForm").addEventListener("submit", async function (e) {

    e.preventDefault(); // prevent page reload

    const urlParams = new URLSearchParams(window.location.search);
    const gameCode = urlParams.get('gameCode');
    const playerId = urlParams.get('playerId');
    const answer = document.getElementById("playerAnswer").value;

    console.log("Submitting answer:", { gameCode, round: roundNumber, playerId, answer });

    const response = await fetch('/api/game/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameCode: gameCode, round: roundNumber, playerId: playerId, answer: answer })
    });

  

    if (!response.ok){
        alert("Failed to submit answer");
    }




});