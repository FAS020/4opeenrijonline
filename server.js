const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

let scores = { red: 0, yellow: 0 }; // Scores van de teams
let currentTeam = 'red'; // Begin met team rood
let board = Array(8).fill(null).map(() => Array(8).fill(null)); // Bord
let timerValue = 10; // Start timer bij 10 seconden
let timerInterval = null; // Timer interval
let teamTimers = { red: 10, yellow: 10 }; // Timer per team
let gamePaused = false; // Boolean om te controleren of het spel gepauzeerd is
let teamCounts = { red: 0, yellow: 0 }; // Aantal spelers per team

// Stemmen voor de huidige beurt
let votes = {};

// Functie om stemmen te resetten
function resetVotes() {
    votes = {};
}

// Functie om stemmen te tellen en een zet te kiezen
function calculateMove() {
    const voteCounts = {};
    Object.values(votes).forEach((col) => {
        voteCounts[col] = (voteCounts[col] || 0) + 1;
    });

    let maxVotes = -1;
    let selectedColumn = null;

    for (const [col, count] of Object.entries(voteCounts)) {
        if (count > maxVotes) {
            maxVotes = count;
            selectedColumn = parseInt(col, 10);
        }
    }

    return selectedColumn !== null ? selectedColumn : Math.floor(Math.random() * 8);
}

// Start een beurt
function startTurn() {
    if (gamePaused) return;

    if (timerInterval) clearInterval(timerInterval);

    resetVotes(); // Reset stemmen voor de nieuwe beurt

    teamTimers = { red: 10, yellow: 10 };
    timerValue = 10;

    io.emit('updateTimer', { team: currentTeam, time: timerValue });

    timerInterval = setInterval(() => {
        if (teamTimers[currentTeam] > 0) {
            teamTimers[currentTeam]--;
            io.emit('updateTimer', { team: currentTeam, time: teamTimers[currentTeam] });
        } else {
            clearInterval(timerInterval);
            const selectedColumn = calculateMove(); // Kies de zet met de meeste stemmen
            makeMove(selectedColumn);
        }
    }, 1000);
}

// Maak een zet
function makeMove(col) {
    if (!board[0][col] && !gamePaused) {
        for (let row = 7; row >= 0; row--) {
            if (!board[row][col]) {
                board[row][col] = currentTeam;
                break;
            }
        }
        checkForWinner();
        currentTeam = currentTeam === 'red' ? 'yellow' : 'red';
        io.emit('updateBoard', board);
        io.emit('gameStatus', { board, scores, currentTeam });
        startTurn();
    }
}

// Wissel de beurt
function switchTurn() {
    currentTeam = currentTeam === 'red' ? 'yellow' : 'red';
    io.emit('gameStatus', { board, scores, currentTeam });
    startTurn();
}

// Controleer of iemand 4 op een rij heeft
function checkForWinner() {
    // Horizontaal
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 5; col++) {
            if (
                board[row][col] &&
                board[row][col] === board[row][col + 1] &&
                board[row][col] === board[row][col + 2] &&
                board[row][col] === board[row][col + 3]
            ) {
                endGame(board[row][col]);
                return;
            }
        }
    }

    // Verticaal
    for (let col = 0; col < 8; col++) {
        for (let row = 0; row < 5; row++) {
            if (
                board[row][col] &&
                board[row][col] === board[row + 1][col] &&
                board[row][col] === board[row + 2][col] &&
                board[row][col] === board[row + 3][col]
            ) {
                endGame(board[row][col]);
                return;
            }
        }
    }

    // Diagonaal (linksboven naar rechtsonder)
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
            if (
                board[row][col] &&
                board[row][col] === board[row + 1][col + 1] &&
                board[row][col] === board[row + 2][col + 2] &&
                board[row][col] === board[row + 3][col + 3]
            ) {
                endGame(board[row][col]);
                return;
            }
        }
    }

    // Diagonaal (rechtsboven naar linksonder)
    for (let row = 0; row < 5; row++) {
        for (let col = 3; col < 8; col++) {
            if (
                board[row][col] &&
                board[row][col] === board[row + 1][col - 1] &&
                board[row][col] === board[row + 2][col - 2] &&
                board[row][col] === board[row + 3][col - 3]
            ) {
                endGame(board[row][col]);
                return;
            }
        }
    }

    // Add draw check after all win conditions
    let isDraw = true;
    for (let col = 0; col < 8; col++) {
        if (!board[0][col]) {
            isDraw = false;
            break;
        }
    }

    if (isDraw) {
        endGame('draw');
        return;
    }
}

// Eindig het spel
function endGame(winner) {
    if (winner === 'draw') {
        // Give both teams a point
        scores.red += 1;
        scores.yellow += 1;
        io.emit('gameOver', 'Gelijkspel');
        console.log('Gelijkspel');
        console.log('Scores:', scores);
    } else if (winner === 'red') {
        scores.red += 1;
        io.emit('gameOver', winner);
    } else if (winner === 'yellow') {
        scores.yellow += 1;
        io.emit('gameOver', winner);
    }

    gamePaused = true;
    setTimeout(() => {
        gamePaused = false;
        resetBoard();
    }, 3000);
}

// Reset het bord
function resetBoard() {
    board = Array(8).fill(null).map(() => Array(8).fill(null));
    io.emit('updateBoard', board);

    currentTeam = scores.red > scores.yellow ? 'red' : scores.red < scores.yellow ? 'yellow' : Math.random() < 0.5 ? 'red' : 'yellow';

    io.emit('gameStatus', { board, scores, currentTeam });
    startTurn();
}

io.on('connection', (socket) => {
    console.log('Nieuwe speler verbonden');
    socket.emit('gameStatus', { board, scores, currentTeam });

    socket.on('chooseTeam', (team) => {
        console.log(`${socket.id} kiest team ${team}`);
        
        // Remove from old team if switching
        if (socket.team) {
            teamCounts[socket.team]--;
        }
        
        socket.team = team;
        teamCounts[team]++;
        
        // Emit updated counts to all clients
        io.emit('updateTeamCounts', teamCounts);
        startTurn();
    });

    socket.on('makeVote', (col) => {
        if (socket.team === currentTeam) {
            votes[socket.id] = col; // Registreer de stem van deze speler
        }
    });

    socket.on('newGame', () => {
        resetBoard();
    });

    socket.on('disconnect', () => {
        if (socket.team) {
            teamCounts[socket.team]--;
            io.emit('updateTeamCounts', teamCounts);
        }
    });

});
server.listen(3000, () => {
    console.log('Server draait op http://localhost:3000');
});