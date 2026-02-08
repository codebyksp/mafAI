
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);

function getPlayerSubmissions(gameCode) {
	const submissionsRef = ref(
		db,
		`games/${gameCode}/rounds/${roundNumber}/submissions`
	);

	onValue(submissionsRef, (snapshot) => {
		const submissions = snapshot.val();
		if (!submissions) return;

		const form = document.getElementById("voteForm");
		form.innerHTML = ""; // clear old submissions

		Object.entries(submissions).forEach(([playerId, text], index) => {
			// Create label wrapper
			const label = document.createElement("label");
			label.className = "vote-option";

			// Create radio input
			const radio = document.createElement("input");
			radio.type = "radio";
			radio.name = "vote";
			radio.value = playerId;

			// Submission text
			const span = document.createElement("span");
			span.innerText = text;

			// Assemble
			label.appendChild(radio);
			label.appendChild(span);
			form.appendChild(label);
		});
	});
}


document.addEventListener('DOMContentLoaded', () => {


	const params = new URLSearchParams(window.location.search);
	const gameCode = params.get("gameCode");
	const playerId = urlParams.get('playerId');
	const roundNumber = urlParams.get('roundNumber');

	//get player count

	const numberOfPlayers = await listenToPlayerCount(gameCode);

	const form = document.getElementById('voteForm');


	for (let i = 0; i < numberOfPlayers; i++) {



		const label = document.createElement("label");
		label.style.display = "block";

		// Create radio input
		const radio = document.createElement("input");
		radio.type = "radio";
		radio.name = "vote";          // SAME name = only one selectable
		radio.value = `player-${i}`;  // value sent on submit
		radio.id = `player-${i}`;

		// Text
		const text = document.createTextNode(` Player ${i}`);

		// Assemble
		label.appendChild(radio);
		label.appendChild(text);
		form.appendChild(label);



	}








=
	



	console.log("Vote Page - Game Code:", gameCode, "Player ID:", playerId, "Round Number:", roundNumber);


});