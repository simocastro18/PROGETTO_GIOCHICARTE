// bot.js
class CirullaBot {
    
    // Il "Cervello" del Bot. Riceve in pasto la sua mano e le carte sul tavolo.
    static getBestMove(hand, table) {
        
        // 1. CICLO DI ATTACCO: Proviamo a vedere se possiamo MANGIARE qualcosa
        for (let i = 0; i < hand.length; i++) {
            let card = hand[i];

            // A. Regola: Asso Pigliatutto
            let aceOnTableIndex = table.findIndex(c => c.value === 1);
            if (card.value === 1 && aceOnTableIndex === -1 && table.length > 0) {
                return {
                    cardIndex: i,
                    selectedTableIndices: table.map((_, idx) => idx), // Prende tutto l'array del tavolo!
                    reason: "Asso Pigliatutto"
                };
            }

            // B. Regola: Obbligo dell'Asso
            if (card.value === 1 && aceOnTableIndex !== -1) {
                return {
                    cardIndex: i,
                    selectedTableIndices: [aceOnTableIndex],
                    reason: "Obbligo di Asso"
                };
            }

            // C. Regola: Obbligo di Presa Esatta
            let exactMatchIndex = table.findIndex(c => c.value === card.value);
            if (exactMatchIndex !== -1 && card.value !== 1) {
                return {
                    cardIndex: i,
                    selectedTableIndices: [exactMatchIndex],
                    reason: "Presa Esatta"
                };
            }

            // D. Regola: Presa da 15 (La carta + una combinazione sul tavolo fa 15?)
            let combo15 = this.findCombo(table, 15 - card.value);
            if (combo15) {
                return { 
                    cardIndex: i, 
                    selectedTableIndices: combo15,
                    reason: "Presa da 15"
                };
            }

            // E. Regola: Presa per Somma (La carta è uguale alla somma?)
            // FIX: Il Bot sa che le figure (8, 9, 10) non possono farlo!
            if (card.value <= 7) {
                let comboSum = this.findCombo(table, card.value);
                if (comboSum) {
                    return { 
                        cardIndex: i, 
                        selectedTableIndices: comboSum,
                        reason: "Presa per Somma"
                    };
                }
            }
        }

        // 2. CICLO DI DIFESA: Se siamo arrivati fin qui, non possiamo prendere nulla. Dobbiamo SCARTARE.
        // Il Bot Facile cerca la carta col valore più basso per non regalare figure, 7 o l'Asso.
        let cardToDiscardIndex = 0;
        let lowestValue = 99;

        for (let i = 0; i < hand.length; i++) {
            // Evita di scartare l'Asso (valore 1) se possibile, meglio scartare un 2 o un 3.
            let safeValue = hand[i].value === 1 ? 11 : hand[i].value; 
            
            if (safeValue < lowestValue) {
                lowestValue = safeValue;
                cardToDiscardIndex = i;
            }
        }
        
        return {
            cardIndex: cardToDiscardIndex,
            selectedTableIndices: [],
            reason: "Scarto al ribasso"
        };
    }

    // --- FUNZIONE MATEMATICA NINJA ---
    // Trova automaticamente quali indici del tavolo sommati danno il 'target'
    static findCombo(table, target) {
        // Genera tutte le possibili combinazioni di carte sul tavolo
        const getSubsets = (array) => array.reduce(
            (subsets, value) => subsets.concat(subsets.map(set => [...set, value])),
            [[]]
        );

        // Prende solo gli indici [0, 1, 2, 3...]
        let tableIndices = table.map((_, idx) => idx);
        let allSubsets = getSubsets(tableIndices).filter(s => s.length > 0);
        
        // Cerca la prima combinazione che dà la somma esatta
        for (let subset of allSubsets) {
            let sum = subset.reduce((acc, idx) => acc + table[idx].value, 0);
            if (sum === target) return subset;
        }
        
        return null; // Nessuna combinazione trovata
    }
}

module.exports = CirullaBot;