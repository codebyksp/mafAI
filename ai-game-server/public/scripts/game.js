// Firebase imports
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue } from "firebase/database";
import { getAnalytics } from "firebase/analytics";

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
const analytics = getAnalytics(app);
const db = getDatabase(app);  // <-- initialize database


// Listen to prompt updates
function listenToPrompt(gameCode: string) {
  const promptRef = ref(db, `games/${gameCode}/rounds/1/prompt`);

  onValue(promptRef, (snapshot) => {
    const prompt = snapshot.val();
    if (prompt) {


      console.log("New prompt received:", prompt);
      const wrapper = document.getElementById('wrapper');
      if (wrapper){ wrapper.innerText = prompt;}
    }
  });
}




document.addEventListener('DOMContentLoaded', async() => {


    const urlParams = new URLSearchParams(window.location.search);
    const gameCode = urlParams.get('gameCode');
    const playerId = urlParams.get('playerId');

    if (!gameCode || !playerId) {
        alert("Fatal Error");
        window.location.href = 'home.html'; // Redirect back to home
    }
    else {
    lisenToPrompt(gameCode);


    }



});