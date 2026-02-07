document.getElementById('joinForm').addEventListener('submit', async function (e) {
    e.preventDefault(); // prevent page reload

    const gameCode = document.getElementById('roomID').value;
    const playerId = crypto.randomUUID(); // generate a simple unique ID

    //check if game code is empty

    if (!gameCode) {
        alert("Please enter a room number!");
        return;
    }

    try {
        //try and joing game

        const response = await fetch('http://localhost:3000/api/game/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameCode, playerId })
        });

        const data = await response.json();

        if (response.ok) {
            console.log("Joined game:", data);
            // Redirect to game page and send gameCode and playerId
            window.location.href = `game.html?gameCode=${encodeURIComponent(gameCode)}&playerId=${encodeURIComponent(playerId)}`;
        } else {
            alert(data.error || "Failed to join game");
        }
    } catch (err) {
        console.error("Error joining game:", err);
        alert("Network error");
    }

});



//if click on host button, redirect to host game page

document.getElementById("host").addEventListener("click", function () {

    window.location.href = "host.html";

});
