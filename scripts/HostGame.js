document.getElementById("title").addEventListener("click", function () {

    window.location.href = "home.html";

});


document.getElementById('hostForm').addEventListener('submit', async function (e) {
    e.preventDefault(); // prevent page reload

    //get hostID

    const hostID = "hello"; // generate a simple unique ID

    try {

        console.log("Creating game with hostID:", hostID);

            const response = await fetch('http://localhost:3000/api/game/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hostId: hostID })
            });

            const data = await response.json();


            if (response.ok) {
                console.log("Game created:", data);
                // Redirect to waiting room page with gameCode and hostID
                window.location.href = `hostWaitingRoom.html?gameCode=${encodeURIComponent(data.gameCode)}&hostID=${encodeURIComponent(hostID)}`;
            }
            else {
                alert("Failed to create game");
            }
        }
        catch (err) {
            alert("Network error");
        }

    
});