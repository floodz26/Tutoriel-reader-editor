/**
 * Calculator Import Module
 * Convertit des données de feuilles de calcul LibreOffice/Excel en calculateurs JSON
 *
 * Format attendu (TSV) :
 * Label\tValeur\tUnité\tMin\tMax\tStep
 * Diamètre de la yourte\t6\tm\t4\t10\t0.5
 * Surface\t=PI()*A1^2\tm²
 */

class CalculatorImporter {
    constructor() {
        // Mapping des fonctions LibreOffice → JavaScript
        this.functionMap = {
            'PI': 'Math.PI',
            'SQRT': 'Math.sqrt',
            'POW': 'Math.pow',
            'ABS': 'Math.abs',
            'ROUND': 'Math.round',
            'FLOOR': 'Math.floor',
            'CEIL': 'Math.ceil',
            'SIN': 'Math.sin',
            'COS': 'Math.cos',
            'TAN': 'Math.tan',
            'MIN': 'Math.min',
            'MAX': 'Math.max',
            'EXP': 'Math.exp',
            'LOG': 'Math.log'
        };
    }

    /**
     * Parse les données TSV collées depuis LibreOffice
     * @param {string} tsvData - Données TSV
     * @returns {Array} Tableau de lignes parsées
     */
    parseTSV(tsvData) {
        const lines = tsvData.trim().split('\n');
        return lines.map(line => line.split('\t'));
    }

    /**
     * Détecte si une valeur est une formule
     * @param {string} value - Valeur à tester
     * @returns {boolean}
     */
    isFormula(value) {
        return typeof value === 'string' && value.trim().startsWith('=');
    }

    /**
     * Convertit une référence de cellule (B2, B3) en ID JavaScript
     * Dans notre système : chaque ligne du TSV = une variable
     * Seules les références à la colonne B (Valeur) sont acceptées
     * @param {string} cellRef - Référence (ex: "B2", "B3")
     * @param {Map} cellIdMap - Map des indices vers IDs de cellules
     * @returns {string} ID de la cellule
     */
    cellRefToId(cellRef, cellIdMap) {
        const match = cellRef.match(/([A-Z]+)(\d+)/);
        if (!match) return cellRef;

        const col = match[1];
        const row = parseInt(match[2]);

        // Valider que c'est bien la colonne B (Valeur)
        if (col !== 'B') {
            console.warn(`Référence de colonne invalide: ${cellRef} - Seules les références à la colonne B (Valeur) sont supportées`);
            return cellRef;
        }

        // Row 1 = header (ignoré), row 2 = première cellule (index 0), etc.
        // Donc row N → index N-2
        const cellIndex = row - 2;

        if (cellIndex < 0 || cellIndex >= cellIdMap.size) {
            console.warn(`Référence de cellule invalide: ${cellRef} - ligne ${row} hors limites`);
            return cellRef;
        }

        return cellIdMap.get(cellIndex);
    }

    /**
     * Convertit une formule LibreOffice en JavaScript
     * @param {string} formula - Formule (ex: "=A2*B2", "=PI()*A2^2")
     * @param {Map} cellIdMap - Map index → cellId
     * @returns {string} Formule JavaScript
     */
    convertFormula(formula, cellIdMap) {
        let jsFormula = formula.trim().substring(1); // Enlever le =

        // Remplacer les références de cellules (A1, B2, etc.)
        jsFormula = jsFormula.replace(/([A-Z]+)(\d+)/g, (match) => {
            return this.cellRefToId(match, cellIdMap);
        });

        // Remplacer les fonctions LibreOffice
        Object.keys(this.functionMap).forEach(loFunc => {
            const regex = new RegExp(loFunc + '\\(', 'gi');
            jsFormula = jsFormula.replace(regex, this.functionMap[loFunc] + '(');
        });

        // Remplacer PI() sans arguments par Math.PI
        jsFormula = jsFormula.replace(/Math\.PI\(\)/g, 'Math.PI');

        // Remplacer les opérateurs spéciaux
        jsFormula = jsFormula.replace(/\^/g, '**'); // Puissance : ^ → **

        // Gérer les fonctions spéciales LibreOffice
        jsFormula = this.convertSpecialFunctions(jsFormula, cellIdMap);

        return jsFormula;
    }

    /**
     * Convertit les fonctions spéciales LibreOffice
     * @param {string} formula - Formule
     * @returns {string} Formule convertie
     */
    convertSpecialFunctions(formula) {
        // SUM(A1:A5) → (cell_0 + cell_1 + cell_2 + cell_3 + cell_4)
        formula = formula.replace(/SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/gi, (match, col1, row1, col2, row2) => {
            const startRow = parseInt(row1) - 1;
            const endRow = parseInt(row2) - 1;
            const cells = [];
            for (let i = startRow; i <= endRow; i++) {
                cells.push(`cell_${i}`);
            }
            return `(${cells.join(' + ')})`;
        });

        // IF(condition, vrai, faux) → (condition ? vrai : faux)
        formula = formula.replace(/IF\(([^,]+),([^,]+),([^)]+)\)/gi, '($1 ? $2 : $3)');

        return formula;
    }

    /**
     * Génère un ID unique pour une cellule basé sur son label
     * @param {string} label - Label de la cellule
     * @returns {string} ID
     */
    generateCellId(label) {
        return label
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Enlever accents
            .replace(/[^a-z0-9]+/g, '_') // Remplacer espaces et caractères spéciaux
            .replace(/^_+|_+$/g, ''); // Enlever underscores au début/fin
    }

    /**
     * Importe des données de feuille de calcul et génère un calculateur
     * @param {string} tsvData - Données TSV
     * @param {string} name - Nom du calculateur
     * @param {string} description - Description
     * @returns {Object} Objet calculateur
     */
    importFromSpreadsheet(tsvData, name = 'Calculateur importé', description = '') {
        const rows = this.parseTSV(tsvData);
        const cells = [];
        const cellIdMap = new Map(); // Map pour convertir cell index → cell ID
        let cellIndex = 0; // Index des cellules (sans compter le header)

        rows.forEach((row, rowIndex) => {
            if (row.length === 0 || !row[0]) return; // Ignorer lignes vides

            const label = row[0].trim();

            // Ignorer la ligne d'en-tête
            if (rowIndex === 0 || label.toLowerCase() === 'label') return;

            const value = row[1] ? row[1].trim() : '';
            const unit = row[2] ? row[2].trim() : '';
            const min = row[3] ? parseFloat(row[3]) : undefined;
            const max = row[4] ? parseFloat(row[4]) : undefined;
            const step = row[5] ? parseFloat(row[5]) : undefined;

            if (!label) return;

            const cellId = this.generateCellId(label);
            cellIdMap.set(cellIndex, cellId);

            if (this.isFormula(value)) {
                // C'est une formule
                const jsFormula = this.convertFormula(value, cellIdMap);

                cells.push({
                    id: cellId,
                    label: label,
                    type: 'formula',
                    formula: jsFormula,
                    unit: unit,
                    decimals: 2,
                    display: true
                });
            } else if (!isNaN(parseFloat(value))) {
                // C'est une valeur numérique (input)
                cells.push({
                    id: cellId,
                    label: label,
                    type: 'input',
                    valueType: 'number',
                    value: parseFloat(value),
                    min: min,
                    max: max,
                    step: step || 1,
                    unit: unit
                });
            }

            // Incrémenter l'index pour la prochaine cellule
            cellIndex++;
        });

        // Remplacer les références cell_N par les vrais IDs
        cells.forEach(cell => {
            if (cell.type === 'formula') {
                cellIdMap.forEach((id, index) => {
                    const regex = new RegExp(`cell_${index}\\b`, 'g');
                    cell.formula = cell.formula.replace(regex, id);
                });
            }
        });

        return {
            name: name,
            description: description,
            cells: cells
        };
    }

    /**
     * Valide un calculateur importé
     * @param {Object} calculator - Calculateur à valider
     * @returns {Object} { valid: boolean, errors: string[] }
     */
    validate(calculator) {
        const errors = [];

        if (!calculator.cells || calculator.cells.length === 0) {
            errors.push('Le calculateur doit contenir au moins une cellule');
        }

        const cellIds = new Set();
        calculator.cells.forEach((cell, index) => {
            if (!cell.id) {
                errors.push(`Cellule ${index}: ID manquant`);
            } else if (cellIds.has(cell.id)) {
                errors.push(`Cellule ${index}: ID "${cell.id}" en double`);
            } else {
                cellIds.add(cell.id);
            }

            if (!cell.label) {
                errors.push(`Cellule ${index}: Label manquant`);
            }

            if (!['input', 'formula'].includes(cell.type)) {
                errors.push(`Cellule ${index}: Type invalide "${cell.type}"`);
            }

            if (cell.type === 'input' && cell.value === undefined) {
                errors.push(`Cellule ${index}: Valeur manquante pour input`);
            }

            if (cell.type === 'formula' && !cell.formula) {
                errors.push(`Cellule ${index}: Formule manquante`);
            }
        });

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
}

// Export pour utilisation dans le HTML
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CalculatorImporter;
}
