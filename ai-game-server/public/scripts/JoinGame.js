// Handle title click - go back to home
document.getElementById("title").addEventListener("click", function () {
    window.location.href = "home.html";
});

// Handle host button click - go to host page
document.getElementById("host").addEventListener("click", function () {
    window.location.href = "host.html";
});

// Handle join form submission
document.getElementById('joinForm').addEventListener('submit', async function (e) {
    e.preventDefault(); // prevent page reload

    const gameCode = document.getElementById('roomID').value.trim().toUpperCase();
    const playerId = crypto.randomUUID(); // generate a unique ID

    // Validate game code
    if (!gameCode) {
        alert("Please enter a room code!");
        return;
    }

    if (gameCode.length !== 4) {
        alert("Room code must be 4 characters!");
        return;
    }

    // Disable submit button during request
    const submitBtn = this.querySelector('input[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.value = "Joining...";

    try {
        console.log("Attempting to join game:", gameCode);

        const response = await fetch('/api/game/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                gameCode: gameCode, 
                playerId: playerId 
            })
        });

        const data = await response.json();

        if (response.ok) {
            console.log("Successfully joined game:", data);
            // Redirect to game page with parameters
            window.location.href = `game.html?gameCode=${encodeURIComponent(gameCode)}&playerId=${encodeURIComponent(playerId)}`;
        } else {
            // Show error from server
            alert(data.error || "Failed to join game");
            submitBtn.disabled = false;
            submitBtn.value = "Join Game!";
        }
    } catch (err) {
        console.error("Error joining game:", err);
        alert("Network error - please check your connection");
        submitBtn.disabled = false;
        submitBtn.value = "Join Game!";
    }
});

// Handle "How to Play" scroll
document.getElementById("howToPlay").addEventListener("click", function() {
    document.querySelector('.page2').scrollIntoView({ behavior: 'smooth' });
});