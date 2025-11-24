const socket = io();
let myRoom = "";
let myPlayerIndex = -1; 
let gameMode = "";
let selectedTableCards = []; 
let isTransitioning = false; // Variabile per bloccare i click durante il cambio

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

socket.on('updateTable', (state) => {
    // Appena arriva l'aggiornamento, lanciamo la renderizzazione automatica
    renderGame(state);
});

socket.on('error', (data) => {
    alert("⚠️ " + data.message);
    selectedTableCards = [];
    document.querySelectorAll('.table-card').forEach(el => el.classList.remove('selected'));
});

function toggleTableCard(index, divElement) {
    if (isTransitioning) return; // Non si può cliccare durante il passaggio

    const idxInSelection = selectedTableCards.indexOf(index);
    if (idxInSelection > -1) {
        selectedTableCards.splice(idxInSelection, 1);
        divElement.classList.remove('selected');
        divElement.style.border = "1px solid #555";
    } else {
        selectedTableCards.push(index);
        divElement.classList.add('selected');
        divElement.style.border = "3px solid #e74c3c";
    }
}

function renderGame(state) {
    const tableDiv = document.getElementById('table-cards');
    const bottomHandDiv = document.getElementById('p1-hand'); 
    const topHandDiv = document.getElementById('p2-hand'); 
    const bottomInfo = document.getElementById('p1-info');
    const topInfo = document.getElementById('p2-info');
    const overlay = document.getElementById('transition-overlay');
    const nextPlayerText = document.getElementById('next-player-name');

    // 1. Aggiorniamo subito il tavolo e i testi (così si vede la mossa fatta)
    tableDiv.innerHTML = "";
    selectedTableCards = [];
    
    bottomInfo.innerText = `GIOCATORE 1 - Prese: ${state.p1Stats.capturedCount} (Scope: ${state.p1Stats.scopes})`;
    topInfo.innerText = `GIOCATORE 2 - Prese: ${state.p2Stats.capturedCount} (Scope: ${state.p2Stats.scopes})`;

    // Disegna carte tavolo
    state.table.forEach((card, index) => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card table-card';
        cardDiv.innerText = card.label;
        cardDiv.onclick = () => toggleTableCard(index, cardDiv);
        tableDiv.appendChild(cardDiv);
    });

    // 2. Disegniamo le mani MA le lasciamo COPERTE (.hidden-hand) inizialmente
    // Questo serve a resettare il DOM
    bottomHandDiv.innerHTML = "";
    topHandDiv.innerHTML = "";
    
    // Funzione helper per creare le carte (ancora senza onclick)
    const createCard = (card) => {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerText = card.label;
        return div;
    };

    state.p1Hand.forEach(card => bottomHandDiv.appendChild(createCard(card)));
    state.p2Hand.forEach(card => topHandDiv.appendChild(createCard(card)));

    // Messaggio di stato
    document.getElementById('status-msg').innerText = state.message || "Partita in corso";

    // 3. GESTIONE AUTOMAZIONE TRANSIZIONE (Solo Locale)
    if (gameMode === 'locale') {
        
        // Blocchiamo tutto
        isTransitioning = true; 
        
        // Copriamo entrambe le mani subito
        bottomHandDiv.classList.add('hidden-hand');
        topHandDiv.classList.add('hidden-hand');

        // Chi deve giocare ora?
        const turnName = state.turn === 0 ? "GIOCATORE 1" : "GIOCATORE 2";
        
        // Evidenzia testo
        if (state.turn === 0) { bottomInfo.classList.add('active-turn'); topInfo.classList.remove('active-turn'); }
        else { bottomInfo.classList.remove('active-turn'); topInfo.classList.add('active-turn'); }

        // Mostra Overlay "Passa il telefono"
        overlay.style.display = "flex";
        nextPlayerText.innerText = "Tocca a: " + turnName;

        // ATTESA DI 1.5 SECONDI
        setTimeout(() => {
            // Nascondi overlay
            overlay.style.display = "none";
            isTransitioning = false; // Sblocca click

            // Scopri SOLO la mano di chi deve giocare e aggiungi i click
            if (state.turn === 0) {
                // Tocca a P1 (Basso)
                bottomHandDiv.classList.remove('hidden-hand');
                activateHand(bottomHandDiv, state.p1Hand, 0); // Attiva click
            } else {
                // Tocca a P2 (Alto)
                topHandDiv.classList.remove('hidden-hand');
                activateHand(topHandDiv, state.p2Hand, 1); // Attiva click
            }

        }, 1500); // 1.5 secondi di attesa

    } else {
        // --- LOGICA ONLINE (Nessuna attesa, niente overlay) ---
        // (Qui metti la logica online standard se la vuoi mantenere,
        //  altrimenti per ora funziona solo Locale come richiesto).
        // Per l'online non copriamo la mano "mia"
        // ... (Logica online omessa per brevità su richiesta focus locale)
    }
}

// Funzione per rendere cliccabili le carte DOPO il timeout
function activateHand(containerDiv, handData, playerIdx) {
    // Svuotiamo e ridisegniamo con i listener corretti
    containerDiv.innerHTML = "";
    
    handData.forEach((card, index) => {
        const div = document.createElement('div');
        div.className = 'card playable'; // Aggiungi classe hover
        div.innerText = card.label;
        div.style.cursor = "pointer";
        
        // Click per giocare
        div.onclick = () => playCard(index);
        
        containerDiv.appendChild(div);
    });
}

function playCard(index) {
    if (isTransitioning) return; // Sicurezza extra

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
