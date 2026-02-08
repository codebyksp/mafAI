document.addEventListener('DOMContentLoaded', function () {

    // Get gameCode
    const urlParams = new URLSearchParams(window.location.search);
    const gameCode = urlParams.get('gameCode');


    console.log("Game Code:", gameCode);


    // Display game code

    document.getElementById('gameCode').innerHTML = `Game Code: ${gameCode}`;
    

});



document.getElementById("startButton").addEventListener("click", async function () {


    const urlParams = new URLSearchParams(window.location.search);
    const gameCode = urlParams.get('gameCode');

    console.log("Game Code:", gameCode);

    try {

        const response = await fetch('/api/game/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({gameCode:gameCode})
        });



        if (response.ok) {
            //send to game page.
            window.location.href = `game.html?gameCode=${encodeURIComponent(gameCode)}`;
        }
        else {
            alert("Failed to start game");
        }
    }
    catch (err) {
        alert("networ error");
    }


});
