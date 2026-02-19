const socket = io();
let myRoom = "";
let myPlayerIndex = -1; 
let gameMode = "";
let selectedTableCards = []; 
let isTransitioning = false; 

const createCard = (card) => {
    const div = document.createElement('div');
    div.className = 'card';
    
    if (card.hidden) {
        div.setAttribute('data-hidden', 'true');
        div.style.backgroundImage = `url('/cards_franc/back-red.png')`;
        div.style.backgroundSize = 'cover';
        div.style.cursor = 'default';
        return div;
    }

    const fileName = `${card.suit}_${card.value}.png`;
    div.style.backgroundImage = `url('/cards_franc/${fileName}')`;
    div.style.backgroundSize = 'contain';
    div.style.backgroundRepeat = 'no-repeat';
    div.style.backgroundPosition = 'center';
    div.style.backgroundColor = 'transparent'; 
    return div;
};

let selectedMode = "";

// FIX: Funzioni devono essere globali (senza const)
function selectMode(mode) {
    selectedMode = mode;
    document.getElementById('step-1-mode').style.display = 'none';
    document.getElementById('step-2-length').style.display = 'block';
}

function joinGame(length) {
    let pName = document.getElementById('player-name').value.trim() || "Ospite";
    document.getElementById('lobby-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'flex';
    gameMode = selectedMode;
    
    socket.emit('joinGame', { gameType: 'cirulla', mode: selectedMode, playerName: pName, gameLength: length });
}

function requestNextRound() {
    document.getElementById('scoreboard-modal').style.display = 'none'; 
    socket.emit('nextRound', { roomName: myRoom }); 
}

socket.on('gameJoined', (data) => {
    myRoom = data.room;
    myPlayerIndex = data.playerIndex;
});

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

function renderGame(state) {
    const tableDiv = document.getElementById('table-cards');
    const bottomHandDiv = document.getElementById('p1-hand'); 
    const topHandDiv = document.getElementById('p2-hand'); 
    const bottomInfo = document.getElementById('p1-info');
    const topInfo = document.getElementById('p2-info');
    
    const myArea = document.getElementById('area-p1');
    const oppArea = document.getElementById('area-p2');

    bottomInfo.innerText = `${state.myName} | Prese: ${state.myStats.capturedCount} | Scope: ${state.myStats.scopes} | PUNTI: ${state.myStats.totalScore}`;
    topInfo.innerText = `${state.oppName} | Prese: ${state.oppStats.capturedCount} | Scope: ${state.oppStats.scopes} | PUNTI: ${state.oppStats.totalScore}`;

    if (state.turn === state.myPlayerIndex) {
        myArea.classList.add('active-turn');
        oppArea.classList.remove('active-turn');
    } else {
        oppArea.classList.add('active-turn');
        myArea.classList.remove('active-turn');
    }

    tableDiv.innerHTML = "";
    selectedTableCards = [];
    state.table.forEach((card, index) => {
        const cardDiv = createCard(card);
        cardDiv.classList.add('table-card');
        cardDiv.onclick = () => toggleTableCard(index, cardDiv);
        tableDiv.appendChild(cardDiv);
    });

    bottomHandDiv.innerHTML = "";
    topHandDiv.innerHTML = "";
    
    activateHand(topHandDiv, state.oppHandData, false); 
    activateHand(bottomHandDiv, state.myHandData, state.turn === state.myPlayerIndex); 

    if (state.message) document.getElementById('status-msg').innerText = state.message;
    if (state.message && state.message.includes("PARTITA FINITA")) {
        setTimeout(() => alert(state.message), 500);
    }
    
    const lastPlayedContainer = document.getElementById('last-played-container');
    const lastCardVisual = document.getElementById('last-card-visual');
    
    if (state.lastPlayedCard) {
        lastCardVisual.innerHTML = "";
        const cardDiv = createCard(state.lastPlayedCard);
        cardDiv.style.width = "48px"; 
        cardDiv.style.height = "70px";
        cardDiv.style.margin = "0";
        cardDiv.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
        cardDiv.style.cursor = "default";
        cardDiv.style.transform = "none";
        cardDiv.style.borderRadius = "5px";
        
        lastCardVisual.appendChild(cardDiv);
        lastPlayedContainer.style.display = "flex";
    } else {
        lastPlayedContainer.style.display = "none";
    }

    if (state.isMancheFinished && state.lastRoundStats) {
        let myRoundStats = state.myPlayerIndex === 0 ? state.lastRoundStats.p1 : state.lastRoundStats.p2;
        let oppRoundStats = state.myPlayerIndex === 0 ? state.lastRoundStats.p2 : state.lastRoundStats.p1;
        let myTotalScore = state.myStats.totalScore;
        let oppTotalScore = state.oppStats.totalScore;

        document.getElementById('my-carte-val').innerText = myRoundStats.carteCount;
        document.getElementById('my-carte-pts').innerText = myRoundStats.ptCarte;
        document.getElementById('my-denari-val').innerText = myRoundStats.denariCount;
        document.getElementById('my-denari-pts').innerText = myRoundStats.ptDenari;
        document.getElementById('my-settebello-val').innerText = myRoundStats.settebello ? "1" : "0";
        document.getElementById('my-settebello-pts').innerText = myRoundStats.ptSettebello;
        document.getElementById('my-primiera-val').innerText = myRoundStats.primieraScore;
        document.getElementById('my-primiera-pts').innerText = myRoundStats.ptPrimiera;
        document.getElementById('my-scope-val').innerText = myRoundStats.scope;
        document.getElementById('my-scope-pts').innerText = myRoundStats.scope; 
        document.getElementById('my-bonus-val').innerText = myRoundStats.bonusName; 
        document.getElementById('my-bonus-pts').innerHTML = myRoundStats.bonusPts > 0 ? `<span style="color:#2ecc71;">${myRoundStats.bonusPts}</span>` : "0";
        document.getElementById('my-totale-modal').innerText = myTotalScore;

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
        document.getElementById('opp-bonus-val').innerText = oppRoundStats.bonusName; 
        document.getElementById('opp-bonus-pts').innerHTML = oppRoundStats.bonusPts > 0 ? `<span style="color:#2ecc71;">${oppRoundStats.bonusPts}</span>` : "0";
        document.getElementById('opp-totale-modal').innerText = oppTotalScore;

        document.getElementById('scoreboard-modal').style.display = 'flex';
    } else {
        const modal = document.getElementById('scoreboard-modal');
        if (modal) modal.style.display = 'none';
    }
}

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