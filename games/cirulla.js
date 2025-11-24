class CirullaGame {
    constructor() {
        this.deck = [];
        this.players = [
            { id: 0, hand: [], captured: [], scopes: 0 },
            { id: 1, hand: [], captured: [], scopes: 0 }
        ];
        this.table = [];
        this.currentPlayer = 0;
        this.dealer = 0;
        this.lastMessage = "";
        this.gameStarted = false;
        
        this.initializeDeck();
    }

    initializeDeck() {
        const suits = ['♥', '♦', '♣', '♠']; // Cuori, Quadri, Fiori, Picche
        const values = [
            { num: 1, label: 'A' }, { num: 2, label: '2' }, { num: 3, label: '3' },
            { num: 4, label: '4' }, { num: 5, label: '5' }, { num: 6, label: '6' },
            { num: 7, label: '7' }, { num: 8, label: 'J' }, { num: 9, label: 'Q' }, { num: 10, label: 'K' }
        ];
        
        this.deck = [];
        for (let s of suits) {
            for (let v of values) {
                this.deck.push({ suit: s, value: v.num, label: `${v.label}${s}` });
            }
        }
    }

    shuffle() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    startGame() {
        this.initializeDeck();
        this.shuffle();
        this.table = [];
        this.players.forEach(p => { p.hand = []; p.captured = []; p.scopes = 0; });
        this.currentPlayer = 0;
        this.gameStarted = true;

        // 4 carte in tavola
        for(let i=0; i<4; i++) this.table.push(this.deck.pop());
        
        // Verifica assi in tavola (regola: se 2 assi, si rimischia)
        if(this.table.filter(c => c.value === 1).length >= 2) {
            this.lastMessage = "Due Assi in tavola: si rimischia.";
            return this.startGame();
        }

        this.dealCards();
    }

    dealCards() {
        // 3 carte a testa
        for (let i = 0; i < 3; i++) {
            this.players[0].hand.push(this.deck.pop());
            this.players[1].hand.push(this.deck.pop());
        }
    }

    playTurn(cardIndex, selectedTableIndices = []) {
        // Convertiamo gli indici in numeri interi per sicurezza
        selectedTableIndices = selectedTableIndices.map(Number);
        
        const player = this.players[this.currentPlayer];
        const cardPlayed = player.hand[cardIndex]; // La carta che voglio giocare

        if (!cardPlayed) return { success: false, message: "Errore: Carta non trovata" };

        // 1. Recuperiamo le carte dal tavolo che l'utente ha selezionato
        let selectedCards = [];
        for (let idx of selectedTableIndices) {
            if (this.table[idx]) {
                selectedCards.push(this.table[idx]);
            }
        }

        let isValid = false;
        let captureType = "Scarto";

        // --- VALIDAZIONE REGOLE ---

        const tableSum = selectedCards.reduce((acc, c) => acc + c.value, 0);
        const aceOnTable = this.table.find(c => c.value === 1);

        // A. Asso Pigliatutto (se gioco Asso e non ci sono Assi in tavola)
        if (cardPlayed.value === 1 && !aceOnTable) {
            // Prende tutto automaticamente, ignoriamo la selezione dell'utente
            selectedCards = [...this.table];
            selectedTableIndices = this.table.map((_, i) => i); // Seleziona tutti gli indici
            isValid = true;
            captureType = "ASSO PIGLIATUTTO";
        }
        // B. Presa da 15
        else if ((cardPlayed.value + tableSum) === 15 && selectedCards.length > 0) {
            isValid = true;
            captureType = "Presa da 15";
        }
        // C. Presa Uguale (es. 7 prende 7)
        else if (tableSum === cardPlayed.value && selectedCards.length > 0) {
            isValid = true;
            captureType = "Presa uguale";
        }
        // D. Scarto (nessuna carta selezionata)
        else if (selectedCards.length === 0) {
            isValid = true;
            captureType = "Scarto";
        }

        if (!isValid) {
            return { success: false, message: `Mossa non valida (Somma: ${tableSum + cardPlayed.value})` };
        }

        // --- ESECUZIONE ---

        // 1. Rimuovi carta dalla mano
        player.hand.splice(cardIndex, 1);

        if (captureType === "Scarto") {
            this.table.push(cardPlayed);
            this.lastMessage = `Ha scartato ${cardPlayed.label}`;
        } else {
            // 2. Aggiungi alle prese (carta giocata + carte tavolo)
            player.captured.push(cardPlayed, ...selectedCards);

            // 3. RIMUOVI CARTE DAL TAVOLO (Usando gli indici)
            // Creiamo un nuovo array tavolo tenendo solo le carte il cui INDICE NON è tra quelli selezionati
            this.table = this.table.filter((_, index) => !selectedTableIndices.includes(index));

            this.lastMessage = `${captureType}!`;

            // 4. Verifica Scopa
            if (this.table.length === 0 && this.deck.length > 0) {
                player.scopes++;
                this.lastMessage += " SCOPA!";
            }
        }

        // --- FINE TURNO ---
        this.currentPlayer = (this.currentPlayer === 0) ? 1 : 0;

        // Se mani vuote, ridiamo carte o finiamo
        if (this.players[0].hand.length === 0 && this.players[1].hand.length === 0) {
            if (this.deck.length > 0) {
                this.dealCards();
            } else {
                this.lastMessage = "Partita Finita";
                // Qui andrebbe la logica di conteggio punti finale
            }
        }

        return { success: true, message: this.lastMessage };
    }

    getGameState() {
        return {
            table: this.table,
            p1Hand: this.players[0].hand,
            p2Hand: this.players[1].hand,
            turn: this.currentPlayer,
            message: this.lastMessage,
            // DATI PER IL PUNTEGGIO
            p1Stats: {
                capturedCount: this.players[0].captured.length,
                scopes: this.players[0].scopes
            },
            p2Stats: {
                capturedCount: this.players[1].captured.length,
                scopes: this.players[1].scopes
            }
        };
    }
}

module.exports = CirullaGame;