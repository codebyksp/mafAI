
document.addEventListener('DOMContentLoaded', async() => {


    const urlParams = new URLSearchParams(window.location.search);
    const gameCode = urlParams.get('gameCode');
    const playerId = urlParams.get('playerId');

    if (!gameCode || !playerId) {
        alert("Fatal Error");
        window.location.href = 'home.html'; // Redirect back to home
    }
    else {

        /*
        const response = await fetch(`http://localhost:3000/api/game/${gameCode}/state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameCode, playerId })
        });

        */


    }



});