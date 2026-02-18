const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const CirullaGame = require('./games/cirulla');
const CirullaBot = require('./bot'); // Import del Bot

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// ==============================================================
// 🔄 SWITCH AMBIENTE: Scommenta la modalità che vuoi utilizzare
// ==============================================================

// --- MODALITÀ 1: SVILUPPO LOCALE (PC) ---
// Quando apri http://localhost:3000/ carica subito il gioco
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/gameroom.html');
});


// --- MODALITÀ 2: RASPBERRY PI (PRODUZIONE) ---
// Risponde solo sul percorso /gameroom (utile se hai un reverse proxy o un menu principale sul Rasp)
/* app.get('/gameroom', (req, res) => {
    res.sendFile(__dirname + '/public/gameroom.html');
});
*/
// ==============================================================

// Stato del server
let rooms = {}; 
let waitingRooms = []; // Code di attesa per matchmaking online

io.on('connection', (socket) => {
    console.log('Un utente si è connesso:', socket.id);

    // --- GESTIONE INGRESSO PARTITA ---
    socket.on('joinGame', ({ gameType, mode, playerName, gameLength }) => {
        let roomName;
        const pName = playerName || "Ospite";

        if (mode === 'online2') {
            // Matchmaking Online 2 Giocatori
            const availableRoom = waitingRooms.find(r => r.mode === 'online2' && r.gameType === gameType && r.gameLength === gameLength);
            
            if (availableRoom) {
                // Entra come G2
                roomName = availableRoom.id;
                rooms[roomName].players.push({
                    id: socket.id,
                    socketId: socket.id,
                    playerIndex: 1,
                    name: pName
                });
                
                waitingRooms = waitingRooms.filter(r => r.id !== roomName);
                socket.join(roomName);
                console.log(`Giocatore ${socket.id} unito a ${roomName} come P2`);
                
                socket.emit('gameJoined', { 
                    room: roomName, 
                    playerId: socket.id, 
                    playerIndex: 1,
                    name: pName, 
                    waitingForOpponent: false 
                });
                
                io.to(roomName).emit('gameStarted', { message: 'Partita iniziata! Trovato avversario!' });
                sendGameStateToPlayers(roomName);
                
            } else {
                // Crea nuova stanza come G1
                roomName = 'room_' + Date.now();
                rooms[roomName] = {
                    game: new CirullaGame(gameLength),
                    players: [{ id: socket.id, socketId: socket.id, playerIndex: 0, name: pName }],
                    mode: 'online2',
                    gameType: gameType,
                    gameLength: gameLength
                };
                
                waitingRooms.push({ id: roomName, mode: 'online2', gameType, gameLength });
                socket.join(roomName);
                
                socket.emit('gameJoined', { 
                    room: roomName, 
                    playerId: socket.id, 
                    playerIndex: 0, 
                    name: pName,
                    waitingForOpponent: true 
                });
            }
            
        } else if (mode === 'online4') {
            // PREPARAZIONE PER 4 GIOCATORI
            socket.emit('error', { message: "Il Multiplayer a 4 giocatori è in fase di sviluppo. Gioca a 2 o contro l'AI!" });
            
        } else if (mode === 'bot') {
            // --- MODALITÀ: CONTRO IL BOT ---
            roomName = 'bot_' + socket.id;
            rooms[roomName] = {
                game: new CirullaGame(gameLength),
                players: [
                    { id: socket.id, socketId: socket.id, playerIndex: 0, name: pName },
                    { id: 'bot', socketId: 'bot', playerIndex: 1, name: "Intelligenza Artificiale" } 
                ],
                mode: 'bot',
                gameType: gameType
            };
            
            socket.join(roomName);
            
            socket.emit('gameJoined', { 
                room: roomName, 
                playerId: socket.id, 
                playerIndex: 0,
                name: pName, 
                mode: 'bot' 
            });
            
            sendGameStateToPlayers(roomName);
            checkBotTurn(roomName); 
        }
    });

    // --- GESTIONE GIOCATA CARTA ---
    socket.on('playCard', ({ roomName, cardIndex, selectedTableIndices }) => {
        const room = rooms[roomName];
        if (!room) return;

        // Controllo del turno per i giocatori reali
        if (room.mode.startsWith('online')) {
            const player = room.players.find(p => p.socketId === socket.id);
            if (!player || player.playerIndex !== room.game.currentPlayer) {
                socket.emit('error', { message: 'Non è il tuo turno!' });
                return;
            }
        }

        const result = room.game.playTurn(cardIndex, selectedTableIndices || []);
        
        if (!result.success) {
            socket.emit('error', { message: result.message });
            return;
        }

        sendGameStateToPlayers(roomName);
        
        // Se si gioca col Bot ed è il suo turno, scatenalo!
        if (room.mode === 'bot') {
            checkBotTurn(roomName);
        }
    });

    // --- PROSSIMA MANO ---
    socket.on('nextRound', (data) => {
        const room = rooms[data.roomName];
        if (!room || !room.game) return;
        
        room.game.startingPlayer = room.game.startingPlayer === 0 ? 1 : 0;
        room.game.currentPlayer = room.game.startingPlayer;
        
        room.game.isMancheFinished = false;
        room.game.lastRoundStats = null;
        room.game.lastMessage = "Nuova smazzata iniziata!";
        room.game.lastPlayedCard = null;
        
        room.game.players[0].captured = [];
        room.game.players[1].captured = [];
        room.game.players[0].scopes = 0;
        room.game.players[1].scopes = 0;
        room.game.players[0].bonusPoints = 0; 
        room.game.players[1].bonusPoints = 0; 
        room.game.players[0].bonusName = "-"; 
        room.game.players[1].bonusName = "-"; 
        room.game.players[0].isHandRevealed = false; 
        room.game.players[1].isHandRevealed = false; 
        
        room.game.initializeDeck();
        room.game.shuffle();
        room.game.startRound();
        
        sendGameStateToPlayers(data.roomName);
        
        // Se tocca al bot iniziare, fallo partire
        if (room.mode === 'bot') {
            checkBotTurn(data.roomName);
        }
    });

    // --- DISCONNESSIONE ---
    socket.on('disconnect', () => {
        console.log('Utente disconnesso:', socket.id);
        for (let roomName in rooms) {
            const room = rooms[roomName];
            const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
            
            if (playerIndex !== -1) {
                // Avvisa l'altro giocatore (se è umano)
                io.to(roomName).emit('playerDisconnected', { message: 'L\'avversario si è disconnesso. La partita è terminata.' });
                
                // Distruggi completamente la stanza
                delete rooms[roomName];
                waitingRooms = waitingRooms.filter(r => r.id !== roomName);
                break;
            }
        }
    });
});

// --- FUNZIONE CHE ESEGUE LA MOSSA DEL BOT ---
function checkBotTurn(roomName) {
    const room = rooms[roomName];
    if (!room || !room.game || room.game.isMancheFinished) return;
    
    // Controlla se tocca al giocatore 1 (che è il Bot) e ha ancora carte in mano
    if (room.game.currentPlayer === 1 && room.game.players[1].hand.length > 0) {
        
        // Simula il tempo di pensiero umano (1.5 secondi per non renderlo troppo lento)
        setTimeout(() => {
            const botHand = room.game.players[1].hand;
            const table = room.game.table;
            
            const move = CirullaBot.getBestMove(botHand, table);
            room.game.playTurn(move.cardIndex, move.selectedTableIndices);
            
            sendGameStateToPlayers(roomName);
            
        }, 1500); 
    }
}

// --- FUNZIONE HELPER DI INVIO STATO (ANTI-BUG DEFINITIVO) ---
function sendGameStateToPlayers(roomName) {
    const room = rooms[roomName];
    if (!room) return;
    
    const gameState = room.game.getGameState();
    const isFinished = room.game.isMancheFinished;
    const stats = room.game.lastRoundStats;

    const p1Name = room.players[0] ? room.players[0].name : "G1";
    const p2Name = room.players[1] ? room.players[1].name : "G2";
    const p1Revealed = room.game.players[0].isHandRevealed;
    const p2Revealed = room.game.players[1].isHandRevealed;
    
    room.players.forEach(player => {
        if (player.id === 'bot') return; // Il bot non ha uno schermo

        // Capiamo se chi sta per ricevere i dati è il P1 o il P2
        const amIP1 = player.playerIndex === 0;

        // Prepariamo in automatico LE MIE carte (SEMPRE SCOPERTE)
        let myHand = amIP1 ? gameState.p1Hand : gameState.p2Hand;
        myHand = myHand.map(c => ({...c, hidden: false})); // Strappa il dorso!

        // Prepariamo in automatico le carte DELL'AVVERSARIO (COPERTE se non ha bussato)
        let oppHand = amIP1 ? gameState.p2Hand : gameState.p1Hand;
        const oppRevealed = amIP1 ? p2Revealed : p1Revealed;
        if (!oppRevealed) {
            oppHand = oppHand.map(() => ({ hidden: true })); // Mette il dorso!
        }

        // Creiamo un pacchetto perfetto, pronto da stampare a video
        const personalizedState = {
            ...gameState,
            myPlayerIndex: player.playerIndex,
            
            // Dati pre-calcolati per la grafica
            myHandData: myHand,
            oppHandData: oppHand,
            
            myName: (amIP1 ? p1Name : p2Name) + " (Tu)",
            oppName: amIP1 ? p2Name : p1Name,
            
            myStats: amIP1 ? gameState.p1Stats : gameState.p2Stats,
            oppStats: amIP1 ? gameState.p2Stats : gameState.p1Stats,
            
            isMancheFinished: isFinished,
            lastRoundStats: stats,
            mode: room.mode 
        };

        io.to(player.socketId).emit('updateTable', personalizedState);

        // Trucco anti-spam: confrontiamo lo stato prima di inviarlo
        const stateString = JSON.stringify(personalizedState);
        
        if (player.lastSentState !== stateString) {
            io.to(player.socketId).emit('updateTable', personalizedState);
            player.lastSentState = stateString; // Memorizza per la prossima volta
        }
    });
}

server.listen(3000, () => {
    console.log('Server attivo su http://localhost:3000');
});