class CirullaGame {
    constructor(length = '51') {
        // Punteggi totali della "Partita ai 51"
        this.globalScores = [0, 0]; 
        this.gameLength = length; // Salva se è 'veloce' o '51'
        
        // --- IL MAZZIERE CASUALE (Avviene SOLO una volta a partita all'inizio) ---
        this.startingPlayer = Math.floor(Math.random() * 2); 
        
        // Inizializza la prima manche
        this.resetManche();
    }

    // Funzione per azzerare il tavolo ma mantenere i punteggi globali
    resetManche() {
        this.deck = [];
        this.players = [
            { id: 0, hand: [], captured: [], scopes: 0, tempPoints: 0, isHandRevealed: false, bonusPoints: 0, bonusName: "-" },
            { id: 1, hand: [], captured: [], scopes: 0, tempPoints: 0, isHandRevealed: false, bonusPoints: 0, bonusName: "-" }
        ];
        this.table = [];
        
        // Chi inizia questa specifica smazzata?
        this.currentPlayer = this.startingPlayer; 
        
        this.lastMessage = "Nuova Manche Iniziata!";
        this.lastPlayedCard = null;
        this.gameStarted = true;
        this.lastCapturingPlayerIndex = null;
        this.mancheFinished = false;

        this.initializeDeck();
        this.shuffle();
        this.startRound(); 
    }

    initializeDeck() {
        const suits = ['C', 'D', 'F', 'P']; // cuori,denari,fiori,picche
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
        
        // Regola 1: Due Assi in tavola si rimischia
        const acesCount = this.table.filter(c => c.value === 1).length;
        if (acesCount >= 2) {
            this.lastMessage = "Due Assi in tavola: si rimischia tutto.";
            this.initializeDeck(); 
            this.shuffle();
            this.startRound();
            return; // Ferma qui e ricomincia
        }

        // --- REGOLA 2: SCOPE DEL MAZZIERE (15 e 30) ---
        const dealerIndex = this.currentPlayer === 0 ? 1 : 0; 
        
        // Calcoliamo TUTTE le somme possibili generate dalle 4 carte
        let possibleSums = new Set([0]);

        this.table.forEach(c => {
            let nextSums = new Set();
            possibleSums.forEach(s => {
                if (c.value === 7 && c.suit === 'C') {
                    // La Matta può valere da 1 a 10
                    for(let v = 1; v <= 10; v++) nextSums.add(s + v);
                } else if (c.value === 1) {
                    // L'Asso può valere 1 o 11
                    nextSums.add(s + 1);
                    nextSums.add(s + 11);
                } else {
                    // Carta normale
                    nextSums.add(s + c.value);
                }
            });
            possibleSums = nextSums; // Aggiorna le somme
        });

        let tableScopes = 0;
        if (possibleSums.has(30)) {
            tableScopes = 2;
            this.lastMessage = `Il mazziere fa 30 in tavola! +2 Scope al P${dealerIndex + 1}.`;
        } else if (possibleSums.has(15)) {
            tableScopes = 1;
            this.lastMessage = `Il mazziere fa 15 in tavola! +1 Scopa al P${dealerIndex + 1}.`;
        } else {
            this.lastMessage = "Nuova Manche Iniziata!";
        }

        if (tableScopes > 0) this.players[dealerIndex].scopes += tableScopes;

        // Distribuisco le mani ai giocatori
        this.dealCards(true); 
    }

    dealCards(isFirstHandOfManche = false) {

        this.players[0].isHandRevealed = false;
        this.players[1].isHandRevealed = false;
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

        let hasMatta = false;
        let otherCards = [];

        // 1. Analizziamo la mano: c'è la Matta?
        hand.forEach(c => {
            if (c.value === 7 && c.suit === 'C') { // 'C' = Cuori
                hasMatta = true;
            } else {
                otherCards.push(c);
            }
        });

        // Funzione helper: le figure (8,9,10) valgono 10 per il calcolo della Piccola
        const getVal = (c) => (c.value >= 8) ? 10 : c.value;

        let bonusScopes = 0;
        let msg = "";

        // --- CASO 1: ABBIAMO LA MATTA IN MANO ---
        if (hasMatta) {
            let c1 = otherCards[0];
            let c2 = otherCards[1];

            // A. Precedenza assoluta alla GRANDE: Le altre due carte sono uguali?
            if (c1.value === c2.value) {
                bonusScopes = 10;
                msg = "ha il GRANDE grazie alla Matta! +10 Scope";
            } 
            // B. Se non è Grande, proviamo la PICCOLA: La Matta vale 1 per abbassare la somma!
            else {
                let sum2 = getVal(c1) + getVal(c2);
                if (sum2 + 1 <= 9) {
                    bonusScopes = 3;
                    msg = `ha la BUONA con la Matta (Somma ${sum2 + 1})! +3 Scope`;
                }
            }
        } 
        // --- CASO 2: NESSUNA MATTA (Regole standard) ---
        else {
            let sum = getVal(hand[0]) + getVal(hand[1]) + getVal(hand[2]);

            // A. Precedenza assoluta alla GRANDE: 3 carte uguali
            if (hand[0].value === hand[1].value && hand[1].value === hand[2].value) {
                bonusScopes = 10;
                msg = "ha il GRANDE (3 carte uguali)! +10 Scope";
            }
            // B. Altrimenti PICCOLA: Somma <= 9
            else if (sum <= 9) {
                bonusScopes = 3;
                msg = `ha la BUONA (Somma ${sum})! +3 Scope`;
            }
        }

        // --- ESECUZIONE DEL BONUS ---
        // Se abbiamo fatto un Accuso, ci prendiamo le scope e scopriamo le carte!
        if (bonusScopes > 0) {
            this.players[playerIndex].scopes += bonusScopes;
            this.players[playerIndex].isHandRevealed = true; // Scopre le carte all'avversario
            this.lastMessage += ` G${playerIndex+1} ${msg} `;
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
        const exactMatchOnTable = this.table.find(c => c.value === cardPlayed.value); // <--- NUOVO CONTROLLO ARBITRO

        // A. L'Asso Pigliatutto (Gioco Asso, NESSUN Asso in tavola, e tavolo NON vuoto)
        if (cardPlayed.value === 1 && !aceOnTable && this.table.length > 0) {
            selectedCards = [...this.table];
            selectedTableIndices = this.table.map((_, i) => i);
            isValid = true;
            captureType = "ASSO PIGLIATUTTO";
            
        }
        // B. L'Obbligo dell'Asso (Gioco Asso, C'E' un Asso in tavola)
        else if (cardPlayed.value === 1 && aceOnTable) {
            if (selectedCards.length === 1 && selectedCards[0].value === 1) {
                isValid = true;
                captureType = "Presa uguale";
            } else {
                return { success: false, message: "Regola dell'Asso: Devi prendere l'Asso presente in tavola!" };
            }
            
        }
        // C. LA LEGGE DELL'OBBLIGO DI PRESA (Se c'è la stessa carta, DEVI prendere quella e nient'altro)
        else if (exactMatchOnTable && cardPlayed.value !== 1) {
            if (selectedCards.length === 1 && selectedCards[0].value === cardPlayed.value) {
                isValid = true;
                captureType = "Presa uguale";
            } else {
                return { success: false, message: `Obbligo di presa: c'è già un ${cardPlayed.value} in tavola! Devi prendere quello.` };
            }
            
        }
        // D. Presa da 15 (Solo se non è scattato l'obbligo di presa qui sopra)
        else if ((cardPlayed.value + tableSum) === 15 && selectedCards.length > 0) {
            isValid = true;
            captureType = "Presa da 15";
            
        }
        // E. Presa per Somma (es. Gioco 7, prendo 4 e 3)
        // FIX: Le figure (valore 8, 9, 10) NON possono prendere per somma!
        else if (tableSum === cardPlayed.value && selectedCards.length > 1 && cardPlayed.value <= 7) {
            isValid = true;
            captureType = "Presa per somma";
            
        }
        // F. Scarto
        else if (selectedCards.length === 0) {
            isValid = true;
            captureType = "Scarto";
        }
        // --- FINE FIX ---

        if (!isValid) {
            return { success: false, message: `Mossa non valida (Somma: ${tableSum + cardPlayed.value})` };
        }

        if (captureType !== "Scarto") {
            this.lastCaptureIndex = this.currentPlayer;
        }

        // --- ESECUZIONE ---
        
        player.hand.splice(cardIndex, 1);
        
        this.lastPlayedCard = cardPlayed; // <--- IL SERVER SI MEMORIZZA LA CARTA!
        const pName = `Il Giocatore ${this.currentPlayer + 1}`; // Per il messaggio

        if (captureType === "Scarto") {
            this.table.push(cardPlayed);
            this.lastMessage = `${pName} scarta.`; 
        } else {
            player.captured.push(cardPlayed, ...selectedCards);
            this.lastCapturingPlayerIndex = this.currentPlayer;
            this.table = this.table.filter((_, index) => !selectedTableIndices.includes(index));
            
            // Messaggio più chiaro
            if (captureType === "ASSO PIGLIATUTTO") this.lastMessage = `${pName} fa ASSO PIGLIATUTTO!`;
            else this.lastMessage = `${pName} prende!`;

            // Scopa?
            const isVeryLastCard = (this.deck.length === 0 && 
                                    this.players[0].hand.length === 0 && 
                                    this.players[1].hand.length === 0);

            if (this.table.length === 0 && !isVeryLastCard) {
                player.scopes++;
                this.lastMessage += " E FA SCOPA! 🧹";
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
        // 1. Assegna le carte rimaste in tavola all'ultimo che ha preso
        if (this.table.length > 0 && this.lastCaptureIndex !== -1) {
            this.players[this.lastCaptureIndex].captured.push(...this.table);
            this.table = [];
            this.lastMessage = "Le carte in tavola vanno all'ultima presa.";
        }

        let p1 = this.players[0];
        let p2 = this.players[1];

        // --- CALCOLO BONUS (Piccola e Grande) ---
        const calcBonus = (captured) => {
            let pts = 0;
            let name = "-";
            
            // Estraiamo solo i valori dei Denari (Ori)
            const ori = captured.filter(c => c.suit === 'D').map(c => c.value);
            
            // GRANDE: Fante (8), Donna (9), Re (10)
            if (ori.includes(8) && ori.includes(9) && ori.includes(10)) {
                pts += 5;
                name = "Grande";
            }
            
            // PICCOLA: Asso(1), 2, 3 (più eventuali 4, 5, 6)
            let picPts = 0;
            if (ori.includes(1) && ori.includes(2) && ori.includes(3)) {
                picPts = 3;
                if (ori.includes(4)) {
                    picPts = 4;
                    if (ori.includes(5)) {
                        picPts = 5;
                        if (ori.includes(6)) picPts = 6;
                    }
                }
            }
            
            if (picPts > 0) {
                pts += picPts;
                // Costruiamo la scritta esatta che hai chiesto
                let picName = picPts === 3 ? "Piccola" : `Piccola (${picPts})`;
                if (name === "-") name = picName;
                else name += ` + ${picName}`;
            }
            
            return { pts, name };
        };

        let b1 = calcBonus(p1.captured);
        let b2 = calcBonus(p2.captured);

        // 2. Prepariamo lo Scontrino inserendo i nuovi Bonus
        let scontrino = {
            p1: { carteCount: p1.captured.length, denariCount: 0, settebello: false, primieraScore: 0, scope: p1.scopes, bonusPts: b1.pts, bonusName: b1.name, puntiRound: 0, ptCarte: 0, ptDenari: 0, ptPrimiera: 0, ptSettebello: 0 },
            p2: { carteCount: p2.captured.length, denariCount: 0, settebello: false, primieraScore: 0, scope: p2.scopes, bonusPts: b2.pts, bonusName: b2.name, puntiRound: 0, ptCarte: 0, ptDenari: 0, ptPrimiera: 0, ptSettebello: 0 }
        };

        // 3. Contiamo gli Ori e il Settebello
        p1.captured.forEach(c => {
            if (c.suit === 'D') { 
                scontrino.p1.denariCount++;
                if (c.value === 7) scontrino.p1.settebello = true;
            }
        });
        p2.captured.forEach(c => {
            if (c.suit === 'D') {
                scontrino.p2.denariCount++;
                if (c.value === 7) scontrino.p2.settebello = true;
            }
        });

        // 4. Calcoliamo la Primiera
        scontrino.p1.primieraScore = this.calculatePrimiera(p1.captured);
        scontrino.p2.primieraScore = this.calculatePrimiera(p2.captured);

        // --- 5. ASSEGNAZIONE PUNTI ---
        if (scontrino.p1.carteCount > 20) { scontrino.p1.ptCarte = 1; scontrino.p1.puntiRound++; }
        else if (scontrino.p2.carteCount > 20) { scontrino.p2.ptCarte = 1; scontrino.p2.puntiRound++; }

        if (scontrino.p1.denariCount > 5) { scontrino.p1.ptDenari = 1; scontrino.p1.puntiRound++; }
        else if (scontrino.p2.denariCount > 5) { scontrino.p2.ptDenari = 1; scontrino.p2.puntiRound++; }

        if (scontrino.p1.settebello) { scontrino.p1.ptSettebello = 1; scontrino.p1.puntiRound++; }
        if (scontrino.p2.settebello) { scontrino.p2.ptSettebello = 1; scontrino.p2.puntiRound++; }

        if (scontrino.p1.primieraScore > scontrino.p2.primieraScore) { scontrino.p1.ptPrimiera = 1; scontrino.p1.puntiRound++; }
        else if (scontrino.p2.primieraScore > scontrino.p1.primieraScore) { scontrino.p2.ptPrimiera = 1; scontrino.p2.puntiRound++; }

        // 6. Aggiungiamo le Scope e i BONUS!
        scontrino.p1.puntiRound += scontrino.p1.scope;
        scontrino.p2.puntiRound += scontrino.p2.scope;
        
        scontrino.p1.puntiRound += scontrino.p1.bonusPts; // <-- Aggiunto il bonus finale
        scontrino.p2.puntiRound += scontrino.p2.bonusPts; // <-- Aggiunto il bonus finale

        // 7. Aggiorniamo i punti globali della partita
        this.globalScores[0] += scontrino.p1.puntiRound;
        this.globalScores[1] += scontrino.p2.puntiRound;

        this.lastRoundStats = scontrino;
        this.isMancheFinished = true;
        
        // CONTROLLO VITTORIA FINE MANO
        if (this.gameLength === 'veloce') {
            let winner = this.globalScores[0] > this.globalScores[1] ? 1 : (this.globalScores[1] > this.globalScores[0] ? 2 : 0);
            if (winner === 0) this.lastMessage = "PARTITA VELOCE FINITA IN PAREGGIO!";
            else this.lastMessage = `PARTITA FINITA! HA VINTO IL GIOCATORE ${winner}!`;
        } else if (this.gameLength === '51') {
            if (this.globalScores[0] >= 51 || this.globalScores[1] >= 51) {
                let winner = this.globalScores[0] > this.globalScores[1] ? 1 : 2;
                this.lastMessage = `PARTITA FINITA! HA VINTO IL GIOCATORE ${winner} superando i 51 punti!`;
            }
        }
    }

    // --- FUNZIONE DI SUPPORTO: Calcolo Primiera Universale ---
    calculatePrimiera(cards) {
        // Valori tradizionali della primiera
        // Nel tuo mazzo J=8, Q=9, K=10, quindi i valori sono mappati perfetti!
        const primieraValues = {
            7: 21, 6: 18, 1: 16, 5: 15, 4: 14, 3: 13, 2: 12, 8: 10, 9: 10, 10: 10
        };
        
        let bestCards = {}; // Oggetto vuoto, i semi si creano da soli!
        
        // Trova la carta migliore per ogni seme che hai tra le prese
        cards.forEach(card => {
            let val = primieraValues[card.value] || 0;
            
            // Se non avevamo ancora registrato questo seme, o se questa carta vale di più:
            if (!bestCards[card.suit] || val > bestCards[card.suit]) {
                bestCards[card.suit] = val;
            }
        });
        
        // Ora sommiamo i valori migliori di tutti i semi che hai raccolto
        let sum = 0;
        for (let suit in bestCards) {
            sum += bestCards[suit];
        }
        
        return sum;
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
            isMancheFinished: this.mancheFinished,
            lastRoundStats: this.lastRoundStats,
            lastPlayedCard: this.lastPlayedCard
        };
    }
}

module.exports = CirullaGame;