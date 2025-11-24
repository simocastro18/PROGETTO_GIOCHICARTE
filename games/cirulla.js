class CirullaGame {
    constructor() {
        // Punteggi totali della "Partita ai 51"
        this.globalScores = [0, 0]; 
        
        // Inizializza la prima manche
        this.resetManche();
    }

    // Funzione per azzerare il tavolo ma mantenere i punteggi globali
    resetManche() {
        this.deck = [];
        this.players = [
            { id: 0, hand: [], captured: [], scopes: 0, tempPoints: 0 },
            { id: 1, hand: [], captured: [], scopes: 0, tempPoints: 0 }
        ];
        this.table = [];
        this.currentPlayer = 0; // Inizia sempre chi ha vinto o random (qui facciamo 0 fisso per ora)
        this.lastMessage = "Nuova Manche Iniziata!";
        this.gameStarted = true;
        this.lastCapturingPlayerIndex = null;
        this.mancheFinished = false;

        this.initializeDeck();
        this.shuffle();
        this.startRound(); // Distribuisce e mette in tavola
    }

    initializeDeck() {
        const suits = ['C', 'D', 'F', 'P']; // hearts, diamonds, clubs, spades
        const values = [
            { num: 1, label: 'A' }, { num: 2, label: '2' }, { num: 3, label: '3' },
            { num: 4, label: '4' }, { num: 5, label: '5' }, { num: 6, label: '6' },
            { num: 7, label: '7' }, { num: 8, label: 'J' }, { num: 9, label: 'Q' }, { num: 10, label: 'K' }
        ];
        
        this.deck = [];
        for (let s of suits) {
            for (let v of values) {
                // NOTA: Aggiungiamo "primieraValue" per calcolare i punti dopo
                let pVal = 0;
                if (v.num === 7) pVal = 21;
                else if (v.num === 6) pVal = 18;
                else if (v.num === 1) pVal = 16;
                else if (v.num === 5) pVal = 15;
                else if (v.num === 4) pVal = 14;
                else if (v.num === 3) pVal = 13;
                else if (v.num === 2) pVal = 12;
                else pVal = 10; // Figure

                this.deck.push({ 
                    suit: s, 
                    value: v.num, 
                    label: `${v.label}${s}`,
                    primieraValue: pVal 
                });
            }
        }
    }

    shuffle() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    startRound() {
        // 4 carte in tavola
        this.table = [];
        for(let i=0; i<4; i++) this.table.push(this.deck.pop());
        
        // Regola: Se la somma delle carte in tavola è 15 o 30, il mazziere fa scopa/punti (Regola avanzata, per ora saltiamo per semplicità)
        // Regola: Se ci sono 2 assi in tavola si rimischia (solo a inizio manche)
        const aces = this.table.filter(c => c.value === 1).length;
        if (aces >= 2) {
            this.lastMessage = "Due Assi in tavola: si rimischia.";
            this.initializeDeck(); // Reset totale
            this.shuffle();
            this.startRound();
            return;
        }

        this.dealCards(true); // true = è la prima mano (per gli accusi)
    }

    dealCards(isFirstHandOfManche = false) {
        // 3 carte a testa
        for (let i = 0; i < 3; i++) {
            this.players[0].hand.push(this.deck.pop());
            this.players[1].hand.push(this.deck.pop());
        }

        // --- GESTIONE ACCUSI (Buona e Grande) ---
        // Avviene subito dopo la distribuzione
        this.checkAccusi(0);
        this.checkAccusi(1);
    }

    // Funzione per controllare "Accusi" (Bonus in mano)
    checkAccusi(playerIndex) {
        const hand = this.players[playerIndex].hand;
        if (hand.length !== 3) return;

        // Calcolo somma valori (Attenzione: Figure valgono 10 per l'accuso)
        let sum = 0;
        let values = [];
        
        hand.forEach(c => {
            let val = (c.value >= 8) ? 10 : c.value; // J,Q,K valgono 10 per la somma < 9
            sum += val;
            values.push(c.value);
        });

        let bonusScopes = 0;
        let msg = "";

        // 1. "GRANDE" (Cirullone): 3 carte uguali
        if (values[0] === values[1] && values[1] === values[2]) {
            bonusScopes = 10;
            msg = "ha il GRANDE (3 carte uguali)! +10 Scope";
        }
        // 2. "PICCOLA" (Buona / Cirulla): Somma <= 9
        else if (sum <= 9) {
            bonusScopes = 3;
            msg = `ha la BUONA (Somma ${sum})! +3 Scope`;
        }

        if (bonusScopes > 0) {
            this.players[playerIndex].scopes += bonusScopes;
            // Aggiungiamo al messaggio globale
            this.lastMessage += ` G${playerIndex+1} ${msg}. `;
        }
    }

    playTurn(cardIndex, selectedTableIndices = []) {
        if (this.mancheFinished) return { success: false, message: "Manche finita. Attendi il prossimo round." };

        selectedTableIndices = selectedTableIndices.map(Number);
        const player = this.players[this.currentPlayer];
        const cardPlayed = player.hand[cardIndex]; 

        if (!cardPlayed) return { success: false, message: "Errore: Carta non trovata" };

        let selectedCards = [];
        for (let idx of selectedTableIndices) {
            if (this.table[idx]) selectedCards.push(this.table[idx]);
        }

        let isValid = false;
        let captureType = "Scarto";

        // Logica somme (Ricorda: card.value per 8,9,10 sono giusti qui perché la somma 15 usa i valori facciali, ma per l'asso pigliatutto serve attenzione)
        // Per Cirulla standard: 8(Fante)=8, 9(Cavallo)=9, 10(Re)=10. OK.
        
        const tableSum = selectedCards.reduce((acc, c) => acc + c.value, 0);
        const aceOnTable = this.table.find(c => c.value === 1);

        // A. Asso Pigliatutto
        if (cardPlayed.value === 1 && !aceOnTable) {
            selectedCards = [...this.table];
            selectedTableIndices = this.table.map((_, i) => i);
            isValid = true;
            captureType = "ASSO PIGLIATUTTO";
        }
        // B. Presa da 15
        else if ((cardPlayed.value + tableSum) === 15 && selectedCards.length > 0) {
            isValid = true;
            captureType = "Presa da 15";
        }
        // C. Presa Uguale
        else if (tableSum === cardPlayed.value && selectedCards.length > 0) {
            isValid = true;
            captureType = "Presa uguale";
        }
        // D. Scarto
        else if (selectedCards.length === 0) {
            isValid = true;
            captureType = "Scarto";
        }

        if (!isValid) {
            return { success: false, message: `Mossa non valida (Somma: ${tableSum + cardPlayed.value})` };
        }

        // --- ESECUZIONE ---
        player.hand.splice(cardIndex, 1);

        if (captureType === "Scarto") {
            this.table.push(cardPlayed);
            this.lastMessage = `Ha scartato un ${cardPlayed.label}`; // Usa label breve per pulizia
        } else {
            player.captured.push(cardPlayed, ...selectedCards);
            this.lastCapturingPlayerIndex = this.currentPlayer;
            this.table = this.table.filter((_, index) => !selectedTableIndices.includes(index));
            
            // Messaggio
            if (captureType === "ASSO PIGLIATUTTO") this.lastMessage = "ASSO PIGLIATUTTO!";
            else this.lastMessage = "Presa!";

            // Scopa?
            if (this.table.length === 0 && this.deck.length > 0) {
                player.scopes++;
                this.lastMessage += " SCOPA!";
            }
        }

        // Cambio Turno
        this.currentPlayer = (this.currentPlayer === 0) ? 1 : 0;

        // Controllo fine mani / fine partita
        if (this.players[0].hand.length === 0 && this.players[1].hand.length === 0) {
            if (this.deck.length > 0) {
                this.dealCards();
            } else {
                this.endManche();
            }
        }

        return { success: true, message: this.lastMessage };
    }

    endManche() {
        // Assegna carte rimaste
        if (this.table.length > 0 && this.lastCapturingPlayerIndex !== null) {
            this.players[this.lastCapturingPlayerIndex].captured.push(...this.table);
            this.table = [];
        }

        // CALCOLO PUNTEGGI DI MANCHE
        let roundPoints = [0, 0];
        let p1 = this.players[0];
        let p2 = this.players[1];

        // 1. SCOPE (già contate)
        roundPoints[0] += p1.scopes;
        roundPoints[1] += p2.scopes;

        // 2. CARTE (Chi ne ha di più)
        if (p1.captured.length > p2.captured.length) roundPoints[0]++;
        else if (p2.captured.length > p1.captured.length) roundPoints[1]++;

        // 3. DENARI (Chi ne ha di più) - 'd' è diamonds
        const p1Denari = p1.captured.filter(c => c.suit === 'd').length;
        const p2Denari = p2.captured.filter(c => c.suit === 'd').length;
        if (p1Denari > p2Denari) roundPoints[0]++;
        else if (p2Denari > p1Denari) roundPoints[1]++;

        // 4. SETTEBELLO (7 di quadri/denari)
        const has7belloP1 = p1.captured.some(c => c.suit === 'd' && c.value === 7);
        if (has7belloP1) roundPoints[0]++;
        else roundPoints[1]++; // Se non ce l'ha p1 ce l'ha p2 per forza

        // 5. PRIMIERA (Funzione helper)
        const primieraP1 = this.calculatePrimiera(p1.captured);
        const primieraP2 = this.calculatePrimiera(p2.captured);
        if (primieraP1 > primieraP2) roundPoints[0]++;
        else if (primieraP2 > primieraP1) roundPoints[1]++;

        // AGGIORNA PUNTEGGIO GLOBALE
        this.globalScores[0] += roundPoints[0];
        this.globalScores[1] += roundPoints[1];

        this.mancheFinished = true;
        
        // Verifica VITTORIA FINALE
        if (this.globalScores[0] >= 51 || this.globalScores[1] >= 51) {
             const winner = this.globalScores[0] > this.globalScores[1] ? "GIOCATORE 1" : "GIOCATORE 2";
             this.lastMessage = `PARTITA FINITA! Vince ${winner}. Punti: ${this.globalScores[0]} - ${this.globalScores[1]}`;
        } else {
             this.lastMessage = `Fine Manche. Punteggi Parziali: ${this.globalScores[0]} - ${this.globalScores[1]}. Si continua...`;
             // Qui potresti resettare automaticamente dopo 5 secondi o aspettare un input
             // Per ora lo lasciamo in stato "finished" e il client deve chiedere il reset
             setTimeout(() => this.resetManche(), 5000); // Riavvio automatico manche dopo 5s
        }
    }

    calculatePrimiera(cards) {
        // Trova il valore più alto per ogni seme
        const maxPerSuit = { 'h': 0, 'd': 0, 'c': 0, 's': 0 };
        
        cards.forEach(c => {
            if (c.primieraValue > maxPerSuit[c.suit]) {
                maxPerSuit[c.suit] = c.primieraValue;
            }
        });

        // Somma dei 4 migliori valori (uno per seme)
        // Nota: Nella primiera classica bisogna avere almeno una carta per seme? 
        // In molte varianti conta solo la somma totale, se manca un seme vale 0. Usiamo questa.
        return maxPerSuit['h'] + maxPerSuit['d'] + maxPerSuit['c'] + maxPerSuit['s'];
    }

    getGameState() {
        return {
            table: this.table,
            p1Hand: this.players[0].hand,
            p2Hand: this.players[1].hand,
            turn: this.currentPlayer,
            message: this.lastMessage,
            p1Stats: {
                capturedCount: this.players[0].captured.length,
                scopes: this.players[0].scopes,
                totalScore: this.globalScores[0] // <--- Nuova info per il client
            },
            p2Stats: {
                capturedCount: this.players[1].captured.length,
                scopes: this.players[1].scopes,
                totalScore: this.globalScores[1] // <--- Nuova info per il client
            },
            isMancheFinished: this.mancheFinished
        };
    }
}

module.exports = CirullaGame;