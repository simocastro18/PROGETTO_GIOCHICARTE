const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const CirullaGame = require('./games/cirulla'); // Importiamo la logica (vedi dopo)

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public')); // Serve i file html/css

// Stato del server
let rooms = {}; // Esempio: { 'stanza1': { game: istanzaCirulla, players: [] } }

io.on('connection', (socket) => {
    console.log('Un utente si è connesso:', socket.id);

    // L'utente vuole creare o entrare in una partita
    socket.on('joinGame', ({ gameType, mode }) => {
        // Qui semplifico: creo una stanza fissa "Tavolo1" per testare
        const roomName = "Tavolo1";
        socket.join(roomName);

        if (!rooms[roomName]) {
            // Se la stanza non esiste, la creo
            console.log(`Creazione nuova partita a ${gameType}`);
            if(gameType === 'cirulla') {
                rooms[roomName] = {
                    game: new CirullaGame(),
                    players: [socket.id],
                    mode: mode // 'online' o 'locale'
                };
            }
        } else {
            // Se esiste, aggiungo il giocatore
            rooms[roomName].players.push(socket.id);
        }

        // Avvisiamo il client che è entrato
        socket.emit('gameJoined', { room: roomName, playerId: socket.id });

        // Se siamo in due o se è modalità "locale" (passa il telefono), iniziamo
        const currentRoom = rooms[roomName];
        if (currentRoom.mode === 'locale' || currentRoom.players.length === 2) {
            currentRoom.game.startGame();
            io.to(roomName).emit('updateTable', currentRoom.game.getGameState());
        }
    });

    // L'utente gioca una carta
    socket.on('playCard', ({ roomName, cardIndex }) => {
        const room = rooms[roomName];
        if (room) {
            const result = room.game.playTurn(cardIndex); // Logica del gioco
            // Invio il nuovo stato a TUTTI nella stanza
            io.to(roomName).emit('updateTable', room.game.getGameState());
            io.to(roomName).emit('message', result.message); // Es: "Presa scopa!"
        }
    });
});

server.listen(3000, () => {
    console.log('Server attivo su http://localhost:3000');
});