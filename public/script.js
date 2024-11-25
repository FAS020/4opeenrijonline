const socket = io();

let selectedTeam = null;
let currentBoard = [];
let currentTeam = 'red';
let timerValue = 10;
let timerInterval = null;
let voteColumn = null;

// Event listeners voor het kiezen van een team
document.getElementById('redTeam').addEventListener('click', () => chooseTeam('red'));
document.getElementById('yellowTeam').addEventListener('click', () => chooseTeam('yellow'));

// Event listener voor het spelregels icoon
document.getElementById('rulesIcon').addEventListener('click', toggleRulesPopup);

// Functie om een team te kiezen
function chooseTeam(team) {
    selectedTeam = team;
    socket.emit('chooseTeam', team);
    
    // Verberg het logo zodra een team is gekozen
    document.getElementById('logoContainer').classList.add('hidden');
    
    // Toon de game-container
    document.getElementById('teamSelection').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'block';
}

// Bij ontvangst van de status van het spel
socket.on('gameStatus', (status) => {
    currentBoard = status.board;
    currentTeam = status.currentTeam;
    updateBoard();
    
    // Update de score icoontjes
    document.getElementById('scoreRedValue').textContent = status.scores.red;
    document.getElementById('scoreYellowValue').textContent = status.scores.yellow;

    // Vertaal de tekst van het huidige team naar 'ROOD' of 'GEEL'
    document.getElementById('currentTeam').textContent = `${status.currentTeam === 'red' ? 'ROOD' : 'GEEL'}`;
    
    // Update de kleur van de huidige team tekst
    const currentTeamElement = document.getElementById('currentTeam');
    currentTeamElement.classList.remove('red', 'yellow');
    currentTeamElement.classList.add(status.currentTeam); // Kleur van de tekst aanpassen

    startTimer(); // Start de timer voor de beurt
    
    // Update de voting info
    updateVotingInfo();
});

// Bij ontvangst van het game-over bericht (wanneer een team wint)
socket.on('gameOver', (winner) => {
    const winnerMessage = document.getElementById('winnerMessage');
    
    // Zet de tekst op "WINNAAR"
    winnerMessage.textContent = "WINNAAR";
    
    // Verander de tekstkleur afhankelijk van het winnende team
    winnerMessage.style.color = winner === 'red' ? '#ff0000' : '#fff200';  // Rood of Geel

    // Zorg dat de winnaar bericht wordt getoond
    winnerMessage.style.display = 'block';

    // Na 3 seconden de tekst verwijderen en het nieuwe spel starten
    setTimeout(() => {
        winnerMessage.style.display = 'none'; // Verwijder het winbericht
        resetGame(); // Start het nieuwe spel na 3 seconden pauze
    }, 3000);
});


// Bij ontvangst van de update van het bord
socket.on('updateBoard', (board) => {
    currentBoard = board;
    updateBoard();
});

// Bij ontvangst van de timer update
socket.on('updateTimer', (data) => {
    if (data.team === currentTeam) {
        timerValue = data.time;
        updateTimerDisplay();
    }
});

// Functie om het bord weer te geven
function updateBoard() {
    const board = document.getElementById('gameBoard');
    board.innerHTML = ''; // Maak het bord leeg
    for (let row = 0; row < 8; row++) {
        const tr = document.createElement('tr');
        for (let col = 0; col < 8; col++) {
            const td = document.createElement('td');
            td.style.backgroundColor = currentBoard[row][col] === 'red' ? 'red' : currentBoard[row][col] === 'yellow' ? 'yellow' : 'white';
            td.addEventListener('click', () => voteForMove(col));
            tr.appendChild(td);
        }
        board.appendChild(tr);
    }

    // Pas de highlight toe alleen als het team aan de beurt is
    if (currentTeam === selectedTeam && voteColumn !== null) {
        highlightVote(voteColumn); // Highlight de gekozen kolom voor het actieve team
    }
}

// Functie om een stem te plaatsen voor een zet
function voteForMove(col) {
    if (selectedTeam === currentTeam) {
        voteColumn = col; // Bijhouden welke kolom de speler kiest
        socket.emit('makeVote', col); // Verstuur de stem naar de server
        updateBoard(); // Update het bord met de highlight
    }
}

// Highlight de gekozen kolom zonder het bord uit te rekken
function highlightVote(col) {
    const board = document.getElementById('gameBoard');
    for (let row = 0; row < 8; row++) {
        const cell = board.rows[row].cells[col];
        cell.classList.add(`highlight-${selectedTeam}`);
    }
}

// Functie om de timer bij te werken en weer te geven
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        if (timerValue > 0) {
            timerValue--;
            updateTimerDisplay();
        } else {
            clearInterval(timerInterval);
            socket.emit('endTurn'); // Geef door aan de server dat de beurt voorbij is
            clearSelection(); // Verwijder de geselecteerde kolom na de beurt
        }
    }, 1000);
}

// Functie om de timer weer te geven op de UI
function updateTimerDisplay() {
    const timerElement = document.getElementById('timer');
    timerElement.innerHTML = `
        <img src="links/clock.png" alt="Timer icoon">
        <span>${timerValue}</span>
    `;

    // Verander kleur naar rood als timer <= 3 seconden
    if (timerValue <= 3) {
        timerElement.style.color = '#ff4500'; // Rood
    } else {
        timerElement.style.color = '#ffffff'; // Wit
    }
}

// Functie om het spel te resetten na 3 seconden pauze
function resetGame() {
    socket.emit('newGame');
    currentBoard = Array(8).fill(Array(8).fill(null)); // Reset het bord lokaal
    voteColumn = null; // Reset de kolomselectie
    updateBoard();
    timerValue = 10; // Reset de timer
    updateTimerDisplay();
}

// Functie om de selectie te verwijderen na het plaatsen van een zet
function clearSelection() {
    const highlightedCells = document.querySelectorAll('.highlight-red, .highlight-yellow');
    highlightedCells.forEach(cell => {
        cell.classList.remove('highlight-red', 'highlight-yellow');
    });
}

// Zorg ervoor dat de selectie wordt verwijderd na een zet of aan het begin van een beurt
socket.on('movePlaced', () => {
    clearSelection(); // Verwijder de highlight direct na een zet
});

// Zorg ervoor dat de selectie wordt verwijderd wanneer de beurt voorbij is
socket.on('endTurn', () => {
    clearSelection(); // Verwijder de highlight aan het einde van de beurt
});

// Functie om de spelregels pop-up te tonen/te verbergen
function toggleRulesPopup() {
    const rulesPopup = document.getElementById('rulesPopup');
    rulesPopup.classList.toggle('hidden');
    document.body.classList.toggle('modal-open');
}

// Voeg event listener toe voor de sluitknop
document.getElementById('closeRules').addEventListener('click', () => {
    const rulesPopup = document.getElementById('rulesPopup');
    rulesPopup.classList.add('hidden'); // Verberg de pop-up
    document.body.classList.remove('modal-open'); // Verwijder de open modal class
});


// Functie om de voting info aan te passen afhankelijk van de beurt
function updateVotingInfo() {
    const votingInfo = document.getElementById('votingInfo');
    if (selectedTeam === currentTeam) {
        votingInfo.textContent = "Kies een rij om te stemmen!";
    } else {
        votingInfo.textContent = "Wachten op beurt!";
    }
}
