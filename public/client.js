const socket = io();
let myRoom = "";
let myPlayerIndex = -1; 
let gameMode = "";
let selectedTableCards = []; 
let isTransitioning = false; 

// 1. FIX: Gestione della carta nascosta (Dorso)
const createCard = (card) => {
    const div = document.createElement('div');
    div.className = 'card';
    
    // Se la carta è nascosta, mettiamo subito il dorso e ci fermiamo qui!
    if (card.hidden) {
        div.style.backgroundImage = `url('/cards_franc/back-red.png')`;
        div.style.backgroundSize = 'cover';
        div.style.cursor = 'default';
        return div;
    }

    // Se la carta è scoperta, generiamo l'immagine normale
    const fileName = `${card.suit.toUpperCase()}_${card.value}.png`;
    div.style.backgroundImage = `url('/cards_franc/${fileName}')`;
    div.style.backgroundSize = 'contain';
    div.style.backgroundRepeat = 'no-repeat';
    div.style.backgroundPosition = 'center';
    div.style.backgroundColor = 'transparent'; 
    return div;
};

function joinGame(mode) {
    document.getElementById('lobby-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
    gameMode = mode;
    socket.emit('joinGame', { gameType: 'cirulla', mode: mode });
}

socket.on('gameJoined', (data) => {
    myRoom = data.room;
    myPlayerIndex = data.playerIndex;
});

// 2. FIX: Ascoltiamo quando il matchmaking ha successo
socket.on('gameStarted', (data) => {
    document.getElementById('status-msg').innerText = data.message;
});

socket.on('updateTable', (state) => {
    renderGame(state);
});

socket.on('error', (data) => {
    alert("⚠️ " + data.message);
    selectedTableCards = [];
    document.querySelectorAll('.table-card').forEach(el => el.classList.remove('selected'));
});

function toggleTableCard(index, divElement) {
    if (isTransitioning) return; 

    const idxInSelection = selectedTableCards.indexOf(index);
    if (idxInSelection > -1) {
        selectedTableCards.splice(idxInSelection, 1);
        divElement.classList.remove('selected');
    } else {
        selectedTableCards.push(index);
        divElement.classList.add('selected');
    }
}

// 3. FIX: Prospettiva Dinamica (Io sono sempre in basso!)
function renderGame(state) {
    const tableDiv = document.getElementById('table-cards');
    const bottomHandDiv = document.getElementById('p1-hand'); 
    const topHandDiv = document.getElementById('p2-hand'); 
    const bottomInfo = document.getElementById('p1-info');
    const topInfo = document.getElementById('p2-info');
    const overlay = document.getElementById('transition-overlay');

    // --- LOGICA DELLA PROSPETTIVA ---
    let myHandData, oppHandData, myStats, oppStats, myName, oppName, myIndex;

    if (state.mode === 'locale') {
        // In locale la prospettiva è fissa
        myHandData = state.p1Hand; oppHandData = state.p2Hand;
        myStats = state.p1Stats; oppStats = state.p2Stats;
        myName = "GIOCATORE 1"; oppName = "GIOCATORE 2";
        myIndex = state.turn; // Attiviamo la mano in base al turno
    } else {
        // IN ONLINE: Chi sono io?
        if (state.myPlayerIndex === 0) {
            myHandData = state.p1Hand; oppHandData = state.p2Hand;
            myStats = state.p1Stats; oppStats = state.p2Stats;
            myName = "TU (G1)"; oppName = "AVVERSARIO (G2)";
            myIndex = 0;
        } else {
            // Se sono il G2, inverto i dati! Metto i miei sotto e i suoi sopra.
            myHandData = state.p2Hand; oppHandData = state.p1Hand;
            myStats = state.p2Stats; oppStats = state.p1Stats;
            myName = "TU (G2)"; oppName = "AVVERSARIO (G1)";
            myIndex = 1;
        }
    }

    // Aggiorna i testi in base alla prospettiva
    bottomInfo.innerText = `${myName} - Prese: ${myStats.capturedCount} (Scope: ${myStats.scopes}) | PUNTI: ${myStats.totalScore}`;
    topInfo.innerText = `${oppName} - Prese: ${oppStats.capturedCount} (Scope: ${oppStats.scopes}) | PUNTI: ${oppStats.totalScore}`;

    // Evidenzia chi deve giocare
    if (state.turn === myIndex) {
        bottomInfo.classList.add('active-turn'); topInfo.classList.remove('active-turn');
    } else {
        bottomInfo.classList.remove('active-turn'); topInfo.classList.add('active-turn');
    }

    // Disegna il Tavolo
    tableDiv.innerHTML = "";
    selectedTableCards = [];
    state.table.forEach((card, index) => {
        const cardDiv = createCard(card);
        cardDiv.classList.add('table-card');
        cardDiv.onclick = () => toggleTableCard(index, cardDiv);
        tableDiv.appendChild(cardDiv);
    });

    // Svuota le mani
    bottomHandDiv.innerHTML = "";
    topHandDiv.innerHTML = "";
    
    // Disegna la modalità
    if (state.mode === 'locale') {
        // --- TRANSIZIONE LOCALE ---
        isTransitioning = true; 
        
        // Disegna tutto coperto all'inizio
        myHandData.forEach(c => bottomHandDiv.appendChild(createCard({hidden: true})));
        oppHandData.forEach(c => topHandDiv.appendChild(createCard({hidden: true})));

        const turnName = state.turn === 0 ? "GIOCATORE 1" : "GIOCATORE 2";
        overlay.style.display = "flex";
        document.getElementById('next-player-name').innerText = "Tocca a: " + turnName;

        setTimeout(() => {
            overlay.style.display = "none";
            isTransitioning = false; 

            // Scopri solo la mano di chi deve giocare
            if (state.turn === 0) {
                activateHand(bottomHandDiv, state.p1Hand, true);
            } else {
                activateHand(topHandDiv, state.p2Hand, true);
            }
        }, 1500);

    } else {
        // --- TRANSIZIONE ONLINE (Nessuna attesa) ---
        bottomHandDiv.classList.remove('hidden-hand');
        topHandDiv.classList.remove('hidden-hand');

        // L'avversario (in alto) è sempre coperto, disegniamolo
        oppHandData.forEach(card => topHandDiv.appendChild(createCard(card)));

        // Le mie carte (in basso) sono scoperte. Se è il mio turno, sono cliccabili!
        activateHand(bottomHandDiv, myHandData, state.turn === state.myPlayerIndex);
    }

    if (state.message) document.getElementById('status-msg').innerText = state.message;
    if (state.message && state.message.includes("PARTITA FINITA")) alert(state.message);
   // --- ACCENSIONE TABELLONE FINE MANO ---
    if (state.isMancheFinished && state.lastRoundStats) {
        let myRoundStats, oppRoundStats, myTotalScore, oppTotalScore;
        
        if (state.mode === 'locale' || state.myPlayerIndex === 0) {
            myRoundStats = state.lastRoundStats.p1;
            oppRoundStats = state.lastRoundStats.p2;
            myTotalScore = state.p1Stats.totalScore;
            oppTotalScore = state.p2Stats.totalScore;
        } else {
            myRoundStats = state.lastRoundStats.p2;
            oppRoundStats = state.lastRoundStats.p1;
            myTotalScore = state.p2Stats.totalScore;
            oppTotalScore = state.p1Stats.totalScore;
        }

        // Compiliamo MIEI PUNTI
        document.getElementById('my-carte-val').innerText = myRoundStats.carteCount;
        document.getElementById('my-carte-pts').innerText = myRoundStats.ptCarte;

        document.getElementById('my-denari-val').innerText = myRoundStats.denariCount;
        document.getElementById('my-denari-pts').innerText = myRoundStats.ptDenari;

        document.getElementById('my-settebello-val').innerText = myRoundStats.settebello ? "1" : "0";
        document.getElementById('my-settebello-pts').innerText = myRoundStats.ptSettebello;

        document.getElementById('my-primiera-val').innerText = myRoundStats.primieraScore;
        document.getElementById('my-primiera-pts').innerText = myRoundStats.ptPrimiera;

        document.getElementById('my-scope-val').innerText = myRoundStats.scope;
        document.getElementById('my-scope-pts').innerText = myRoundStats.scope; // Ogni scopa vale 1 punto

        // I Bonus li implementeremo dopo, per ora li prepariamo a zero
        document.getElementById('my-bonus-val').innerText = "-"; 
        document.getElementById('my-bonus-pts').innerText = "0";

        document.getElementById('my-totale-modal').innerText = myTotalScore;

        // Compiliamo AVVERSARIO
        document.getElementById('opp-carte-val').innerText = oppRoundStats.carteCount;
        document.getElementById('opp-carte-pts').innerText = oppRoundStats.ptCarte;

        document.getElementById('opp-denari-val').innerText = oppRoundStats.denariCount;
        document.getElementById('opp-denari-pts').innerText = oppRoundStats.ptDenari;

        document.getElementById('opp-settebello-val').innerText = oppRoundStats.settebello ? "1" : "0";
        document.getElementById('opp-settebello-pts').innerText = oppRoundStats.ptSettebello;

        document.getElementById('opp-primiera-val').innerText = oppRoundStats.primieraScore;
        document.getElementById('opp-primiera-pts').innerText = oppRoundStats.ptPrimiera;

        document.getElementById('opp-scope-val').innerText = oppRoundStats.scope;
        document.getElementById('opp-scope-pts').innerText = oppRoundStats.scope;

        document.getElementById('opp-bonus-val').innerText = "-"; 
        document.getElementById('opp-bonus-pts').innerText = "0";

        document.getElementById('opp-totale-modal').innerText = oppTotalScore;

        // --- LA MAGIA CHE MANCAVA: MOSTRIAMO IL TABELLONE ---
        document.getElementById('scoreboard-modal').style.display = 'flex';
        
    } else {
        // Se stiamo giocando, assicuriamoci che il tabellone sia nascosto
        const modal = document.getElementById('scoreboard-modal');
        if (modal) modal.style.display = 'none';
    }
}

// Funzione helper per disegnare una mano e renderla cliccabile
function activateHand(containerDiv, handData, isMyTurn) {
    containerDiv.innerHTML = ""; 
    
    handData.forEach((card, index) => {
        const div = createCard(card); 
        
        if (isMyTurn && !card.hidden) {
            div.classList.add('playable'); 
            div.style.cursor = "pointer";
            div.onclick = () => playCard(index);
        }
        
        containerDiv.appendChild(div);
    });
}

function playCard(index) {
    if (isTransitioning) return; 

    const cardsOnTableCount = document.getElementById('table-cards').children.length;
    if (cardsOnTableCount > 0 && selectedTableCards.length === 0) {
        if (!confirm("ATTENZIONE:\nNon hai selezionato nessuna carta dal tavolo.\nVuoi SCARTARE?")) return;
    }

    socket.emit('playCard', { 
        roomName: myRoom, 
        cardIndex: index,
        selectedTableIndices: selectedTableCards 
    });
}
// Funzione agganciata al bottone del tabellone
function requestNextRound() {
    document.getElementById('scoreboard-modal').style.display = 'none'; // Nascondi subito
    socket.emit('nextRound', { roomName: myRoom }); // Avvisa il server!
}