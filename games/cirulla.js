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
        
        // <--- NUOVO: Variabile per ricordare chi ha fatto l'ultima presa
        this.lastCapturingPlayerIndex = null; 

        this.initializeDeck();
    }

    // Dentro cirulla.js

    initializeDeck() {
        // Usiamo le sigle che corrispondono ai nomi dei file
        const suits = ['C', 'D', 'F', 'P']; 
        
        const values = [
            { num: 1, label: 'A' }, { num: 2, label: '2' }, { num: 3, label: '3' },
            { num: 4, label: '4' }, { num: 5, label: '5' }, { num: 6, label: '6' },
            { num: 7, label: '7' }, { num: 8, label: 'J' }, { num: 9, label: 'Q' }, { num: 10, label: 'K' }
        ];
        
        this.deck = [];
        for (let s of suits) {
            for (let v of values) {
                // Label ora serve solo per il debug testuale (es: "7d" o "Ac")
                // La proprietà importante ora è che 'suit' è pronto per l'immagine
                this.deck.push({ 
                    suit: s, 
                    value: v.num, 
                    label: `${v.label}${s}` // Esempio: "Ad" (Asso Denari)
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

    startGame() {
        this.initializeDeck();
        this.shuffle();
        this.table = [];
        this.players.forEach(p => { p.hand = []; p.captured = []; p.scopes = 0; });
        this.currentPlayer = 0;
        this.gameStarted = true;
        
        // <--- NUOVO: Resetta il tracciamento prese a inizio partita
        this.lastCapturingPlayerIndex = null;

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
        selectedTableIndices = selectedTableIndices.map(Number);
        
        const player = this.players[this.currentPlayer];
        const cardPlayed = player.hand[cardIndex]; 

        if (!cardPlayed) return { success: false, message: "Errore: Carta non trovata" };

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
            this.lastMessage = `Ha scartato ${cardPlayed.label}`;
        } else {
            // È AVVENUTA UNA PRESA
            player.captured.push(cardPlayed, ...selectedCards);

            // <--- NUOVO: Aggiorniamo chi ha preso per ultimo
            this.lastCapturingPlayerIndex = this.currentPlayer;

            this.table = this.table.filter((_, index) => !selectedTableIndices.includes(index));

            this.lastMessage = `${captureType}!`;

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
                // --- PARTITA FINITA ---
                this.lastMessage = "Partita Finita";
                
                // <--- NUOVO: Assegnazione carte rimanenti
                if (this.table.length > 0) {
                    if (this.lastCapturingPlayerIndex !== null) {
                        const winner = this.players[this.lastCapturingPlayerIndex];
                        
                        // Aggiungi le carte del tavolo al vincitore
                        winner.captured.push(...this.table);
                        
                        // Svuota il tavolo
                        const numCards = this.table.length;
                        this.table = [];
                        
                        this.lastMessage = `Partita Finita. Giocatore ${this.lastCapturingPlayerIndex + 1} prende le ultime ${numCards} carte!`;
                    }
                }
                
                // Qui in futuro aggiungerai il calcolo punti completo (Primiera, denari, ecc.)
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