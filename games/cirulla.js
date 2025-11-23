class CirullaGame {
    constructor() {
        this.deck = [];
        this.tableCards = [];
        // Players: hand = carte in mano, captured = carte prese (mazzetto), scopas = numero scope
        this.players = [
            { id: 0, hand: [], captured: [], scopas: 0 },
            { id: 1, hand: [], captured: [], scopas: 0 }
        ];
        this.turn = 0; // 0 = Giocatore A, 1 = Giocatore B
        this.lastCapturer = null; // Chi ha fatto l'ultima presa (per le carte rimaste alla fine)
        
        this.initDeck();
    }

    initDeck() {
        const suits = ['Denari', 'Coppe', 'Spade', 'Bastoni'];
        // Valori: 1 (Asso) ... 7, 8 (Fante), 9 (Cavallo), 10 (Re)
        this.deck = [];
        for (let s of suits) {
            for (let v = 1; v <= 10; v++) {
                let label = `${v} di ${s}`;
                // Nomi speciali
                if (v === 8) label = `Fante di ${s}`;
                if (v === 9) label = `Cavallo di ${s}`;
                if (v === 10) label = `Re di ${s}`;
                
                this.deck.push({ suit: s, value: v, label: label });
            }
        }
        this.shuffle();
    }

    shuffle() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    startGame() {
        this.deck = []; 
        this.initDeck(); // Rimescola
        this.tableCards = this.deck.splice(0, 4);
        this.distributeCards();
    }

    distributeCards() {
        // Da 3 carte a testa
        this.players[0].hand = this.deck.splice(0, 3);
        this.players[1].hand = this.deck.splice(0, 3);
    }

    playTurn(cardIndex) {
        const currentPlayer = this.players[this.turn];
        let message = "";

        // 1. Controllo Validità
        if (cardIndex >= currentPlayer.hand.length) return { message: "Carta non valida" };

        // Rimuovi carta dalla mano
        const cardPlayed = currentPlayer.hand.splice(cardIndex, 1)[0];
        let capturedCards = [];
        let isScopa = false;

        // --- LOGICA DI PRESA ---

        // CASO A: Asso Pigliatutto
        // Regola: L'asso prende tutto a meno che non ci sia un asso in tavola
        const aceOnTable = this.tableCards.some(c => c.value === 1);
        if (cardPlayed.value === 1 && !aceOnTable) {
            capturedCards = [...this.tableCards];
            this.tableCards = []; // Pulisci tavolo
            message = "ASSO PIGLIATUTTO!";
        } 
        else {
            // CASO B: Presa per Somma 15 (Prioritaria in Cirulla)
            // Cerchiamo combinazioni che sommate alla carta giocata fanno 15
            const targetFor15 = 15 - cardPlayed.value;
            let combination15 = this.findSumCombination(this.tableCards, targetFor15);

            if (combination15.length > 0) {
                capturedCards = combination15;
                // Rimuovi le carte prese dal tavolo
                this.removeCardsFromTable(capturedCards);
                message = `Presa con Somma 15 (${cardPlayed.value} + ${15-cardPlayed.value})`;
            } 
            else {
                // CASO C: Presa Classica (Uguale valore)
                // Regola Scopa: se c'è una carta singola di ugual valore, devi prendere quella.
                // Altrimenti prendi la somma (ma qui semplifichiamo: cerchiamo valore esatto)
                const match = this.tableCards.find(c => c.value === cardPlayed.value);
                if (match) {
                    capturedCards = [match];
                    this.removeCardsFromTable(capturedCards);
                    message = `Presa semplice del ${match.value}`;
                }
            }
        }

        // --- CONCLUSIONE TURNO ---

        if (capturedCards.length > 0) {
            // Metti carte nel mazzetto delle prese (inclusa quella giocata)
            currentPlayer.captured.push(cardPlayed, ...capturedCards);
            this.lastCapturer = this.turn;

            // Controllo SCOPA (Se tavolo vuoto e non era Asso Pigliatutto che a volte non conta scopa, ma in Cirulla di solito sì)
            if (this.tableCards.length === 0) {
                currentPlayer.scopas++;
                isScopa = true;
                message += " - SCOPA!";
            }
        } else {
            // Nessuna presa, lascia carta sul tavolo
            this.tableCards.push(cardPlayed);
            message = `Giocato ${cardPlayed.label}`;
        }

        // Controllo Fine Mano (hanno finito le carte?)
        if (this.players[0].hand.length === 0 && this.players[1].hand.length === 0) {
            if (this.deck.length > 0) {
                this.distributeCards();
                message += " (Nuova mano distribuita)";
            } else {
                // FINE PARTITA
                this.endGameLogic();
                message += " - PARTITA FINITA!";
            }
        }

        // Cambio turno
        this.turn = (this.turn === 0) ? 1 : 0;

        return { message };
    }

    // Funzione Helper: Rimuove carte specifiche dall'array del tavolo
    removeCardsFromTable(cardsToRemove) {
        const idsToRemove = cardsToRemove.map(c => c.suit + c.value); // ID univoco temporaneo
        this.tableCards = this.tableCards.filter(c => !idsToRemove.includes(c.suit + c.value));
    }

    // Algoritmo ricorsivo per trovare somme (Problema "Subset Sum")
    findSumCombination(cards, target) {
        // Strategia semplice: Prova a trovare UNA combinazione valida.
        // In una versione avanzata, dovresti gestire la scelta dell'utente se ce ne sono più di una.
        
        function recurse(index, currentSum, currentCards) {
            if (currentSum === target) return currentCards;
            if (currentSum > target || index >= cards.length) return null;

            // 1. Includi la carta corrente
            const withCard = recurse(index + 1, currentSum + cards[index].value, [...currentCards, cards[index]]);
            if (withCard) return withCard;

            // 2. Escludi la carta corrente
            return recurse(index + 1, currentSum, currentCards);
        }

        return recurse(0, 0, []) || []; // Ritorna array vuoto se nessuna combinazione
    }

    endGameLogic() {
        // Assegna le carte rimaste sul tavolo all'ultimo che ha preso
        if (this.lastCapturer !== null) {
            this.players[this.lastCapturer].captured.push(...this.tableCards);
            this.tableCards = [];
        }
        // Qui dovresti calcolare i punti (Scope, Carte, Denari, Settebello, Primiera)
    }

    getGameState() {
        return {
            table: this.tableCards,
            turn: this.turn,
            p1Hand: this.players[0].hand,
            p2Hand: this.players[1].hand,
            scores: {
                p1: `Scope: ${this.players[0].scopas} | Carte: ${this.players[0].captured.length}`,
                p2: `Scope: ${this.players[1].scopas} | Carte: ${this.players[1].captured.length}`
            }
        };
    }
}

module.exports = CirullaGame;