let soundOn = true;

function startBattle() {
    alert("⚔️ NEXORA BATTLE LOADING!");
}

const soundToggle = document.getElementById("soundToggle");
const soundStatus = document.getElementById("soundStatus");

soundToggle.addEventListener("click", function () {
    soundOn = !soundOn;

    if (soundOn) {
        soundToggle.textContent = "🔊";
        soundStatus.textContent = "SOUND ON";
    } else {
        soundToggle.textContent = "🔇";
        soundStatus.textContent = "SOUND OFF";
    }
});
