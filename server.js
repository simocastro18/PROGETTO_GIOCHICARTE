const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const CirullaGame = require('./games/cirulla');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Stato del server
let rooms = {}; 
let waitingRooms = []; // Code di attesa per matchmaking online

io.on('connection', (socket) => {
    console.log('Un utente si è connesso:', socket.id);

    // --- GESTIONE INGRESSO PARTITA ---
    socket.on('joinGame', ({ gameType, mode }) => {
        let roomName;

        if (mode === 'online') {
            // Matchmaking Online
            const availableRoom = waitingRooms.find(r => r.mode === 'online' && r.gameType === gameType);
            
            if (availableRoom) {
                // Entra come G2
                roomName = availableRoom.id;
                rooms[roomName].players.push({
                    id: socket.id,
                    socketId: socket.id,
                    playerIndex: 1
                });
                
                waitingRooms = waitingRooms.filter(r => r.id !== roomName);
                socket.join(roomName);
                console.log(`Giocatore ${socket.id} unito a ${roomName} come P2`);
                
                // --- INIZIO FIX: Diciamo al G2 in che stanza si trova! ---
                socket.emit('gameJoined', { 
                    room: roomName, 
                    playerId: socket.id, 
                    playerIndex: 1, 
                    waitingForOpponent: false 
                });
                // --- FINE FIX ---

                // NOTA: rimosso rooms[roomName].game.startGame() perché il gioco è già inizializzato dal costruttore
                
                io.to(roomName).emit('gameStarted', { message: 'Partita iniziata! Trovato avversario!' });
                sendGameStateToPlayers(roomName);
                
            } else {
                // Crea nuova stanza
                roomName = 'room_' + Date.now();
                rooms[roomName] = {
                    game: new CirullaGame(), // <--- Il costruttore avvia già la manche e distribuisce le carte
                    players: [{ id: socket.id, socketId: socket.id, playerIndex: 0 }],
                    mode: 'online',
                    gameType: gameType
                };
                
                waitingRooms.push({ id: roomName, mode: 'online', gameType });
                socket.join(roomName);
                
                socket.emit('gameJoined', { 
                    room: roomName, 
                    playerId: socket.id, 
                    playerIndex: 0, 
                    waitingForOpponent: true 
                });
            }
            
        } else if (mode === 'locale') {
            // Partita Locale (Hotseat)
            roomName = 'local_' + socket.id;
            rooms[roomName] = {
                game: new CirullaGame(), // <--- Il costruttore avvia già la manche
                players: [{ id: socket.id, socketId: socket.id, playerIndex: 0 }],
                mode: 'locale',
                gameType: gameType
            };
            
            socket.join(roomName);
            
            // NOTA: rimosso rooms[roomName].game.startGame() perché causava l'errore
            
            socket.emit('gameJoined', { 
                room: roomName, 
                playerId: socket.id, 
                playerIndex: 0, 
                mode: 'locale' 
            });
            sendGameStateToPlayers(roomName);
        }
    });

    // --- GESTIONE GIOCATA CARTA ---
    socket.on('playCard', ({ roomName, cardIndex, selectedTableIndices }) => {
        const room = rooms[roomName];
        if (!room) return;

        // Verifica turno (Solo se online)
        if (room.mode === 'online') {
            const player = room.players.find(p => p.socketId === socket.id);
            if (!player || player.playerIndex !== room.game.currentPlayer) {
                socket.emit('error', { message: 'Non è il tuo turno!' });
                return;
            }
        }

        // Esegui la giocata
        const result = room.game.playTurn(cardIndex, selectedTableIndices || []);
        
        if (!result.success) {
            socket.emit('error', { message: result.message });
            return;
        }

        // Invia aggiornamenti
        sendGameStateToPlayers(roomName);
    });

    // --- DISCONNESSIONE ---
    socket.on('disconnect', () => {
        console.log('Utente disconnesso:', socket.id);
        for (let roomName in rooms) {
            const room = rooms[roomName];
            const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
            
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                io.to(roomName).emit('playerDisconnected', { message: 'Avversario disconnesso.' });
                
                if (room.players.length === 0) {
                    delete rooms[roomName];
                    waitingRooms = waitingRooms.filter(r => r.id !== roomName);
                }
                break;
            }
        }
    });
});

// Funzione helper
function sendGameStateToPlayers(roomName) {
    const room = rooms[roomName];
    if (!room) return;
    
    const gameState = room.game.getGameState();
    
    if (room.mode === 'online') {
        room.players.forEach(player => {
            const personalizedState = {
                ...gameState,
                myPlayerIndex: player.playerIndex,
                // Nascondi carte avversario
                p1Hand: player.playerIndex === 0 ? gameState.p1Hand : gameState.p1Hand.map(() => ({ hidden: true })),
                p2Hand: player.playerIndex === 1 ? gameState.p2Hand : gameState.p2Hand.map(() => ({ hidden: true })),
            };
            io.to(player.socketId).emit('updateTable', personalizedState);
        });
    } else {
        // Locale: mostra tutto
        io.to(roomName).emit('updateTable', { ...gameState, mode: 'locale' });
    }
}

server.listen(3000, () => {
    console.log('Server attivo su http://localhost:3000');
});