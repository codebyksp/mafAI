document.getElementById("title").addEventListener("click", function () {
    window.location.href = "home.html";
});

document.getElementById('hostForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    
    const hostID = crypto.randomUUID();
    const submitBtn = this.querySelector('input[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.value = "Creating...";

    try {
        const response = await fetch('/api/game/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hostId: hostID })
        });

        const data = await response.json();

        if (response.ok) {
            // Wait for Firebase to finish writing
            setTimeout(() => {
                window.location.href = `hostWaitingRoom.html?gameCode=${encodeURIComponent(data.gameCode)}&hostID=${encodeURIComponent(hostID)}`;
            }, 800);
        } else {
            alert(data.error || "Failed to create game");
            submitBtn.disabled = false;
            submitBtn.value = "Create Game!";
        }
    } catch (err) {
        alert("Network error");
        submitBtn.disabled = false;
        submitBtn.value = "Create Game!";
    }
});