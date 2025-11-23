const socket = io();
let myRoom = "";
let myId = "";

function joinGame(mode) {
    // Nascondi lobby, mostra gioco
    document.getElementById('lobby-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
    
    socket.emit('joinGame', { gameType: 'cirulla', mode: mode });
}

socket.on('gameJoined', (data) => {
    myRoom = data.room;
    myId = data.playerId;
    document.getElementById('status-msg').innerText = "Entrato nella stanza: " + myRoom;
});

socket.on('updateTable', (gameState) => {
    renderGame(gameState);
});

socket.on('message', (msg) => {
    console.log(msg);
});

function renderGame(state) {
    const tableDiv = document.getElementById('table-cards');
    const p1Div = document.getElementById('p1-hand');
    const p2Div = document.getElementById('p2-hand');

    // Pulisci tutto
    tableDiv.innerHTML = ""; 
    p1Div.innerHTML = ""; 
    p2Div.innerHTML = "";

    // Disegna Tavolo
    state.table.forEach(card => {
        tableDiv.innerHTML += `<div class="card">${card.label}</div>`;
    });

    // Disegna Mano P1 (Se sei P1 o se è locale)
    state.p1Hand.forEach((card, index) => {
        const btn = document.createElement('div');
        btn.className = 'card';
        btn.innerText = card.label;
        btn.onclick = () => playCard(index); // Clicca per giocare
        p1Div.appendChild(btn);
    });

    // Disegna Mano P2
    state.p2Hand.forEach((card, index) => {
        const btn = document.createElement('div');
        btn.className = 'card';
        btn.innerText = "???"; // Nascondi le carte dell'avversario visivamente
        // Se modalità locale, dovresti mostrare le carte solo quando tocca a lui
        p2Div.appendChild(btn);
    });
    
    // Aggiorna info punteggio
    let statusText = state.turn === 0 ? "Tocca al Giocatore 1" : "Tocca al Giocatore 2";
    
    if(state.scores) {
        const p1Info = `(Tu: ${state.scores.p1})`;
        const p2Info = `(Avv: ${state.scores.p2})`;
        statusText += `\n ${p1Info} vs ${p2Info}`;
    }
    // 3. Scriviamo il risultato finale nel DIV (Usa la variabile statusText!)
    document.getElementById('status-msg').innerText = statusText;
}

function playCard(index) {
    socket.emit('playCard', { roomName: myRoom, cardIndex: index });
}