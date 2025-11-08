#!/usr/bin/env node
/**
 * Test script for calculator-import.js
 * Run with: node test-import.js
 */

const fs = require('fs');

// Load the calculator import module
const CalculatorImporter = require('./calculator-import.js');

// Load the example TSV data
const tsvData = fs.readFileSync('./exemple-calculateur.tsv', 'utf-8');

console.log('📋 TSV Data loaded:');
console.log(tsvData);
console.log('\n' + '='.repeat(80) + '\n');

// Create importer instance
const importer = new CalculatorImporter();

// Import the calculator
console.log('🚀 Importing calculator...\n');
const calculator = importer.importFromSpreadsheet(
    tsvData,
    'Calcul de dimensions de plateforme',
    'Calculateur pour déterminer les dimensions nécessaires'
);

// Validate
console.log('✅ Validating...\n');
const validation = importer.validate(calculator);

if (!validation.valid) {
    console.error('❌ Validation failed:');
    validation.errors.forEach(err => console.error('  - ' + err));
    process.exit(1);
}

console.log('✅ Validation passed!\n');
console.log('='.repeat(80) + '\n');

// Display results
console.log('📊 Calculator:', calculator.name);
console.log('📝 Description:', calculator.description);
console.log('🔢 Number of cells:', calculator.cells.length);
console.log('\n' + '='.repeat(80) + '\n');

console.log('📋 Cells:\n');
calculator.cells.forEach((cell, index) => {
    console.log(`${index + 1}. ${cell.label} (${cell.id})`);
    if (cell.type === 'input') {
        console.log(`   Type: Input`);
        console.log(`   Value: ${cell.value} ${cell.unit}`);
        console.log(`   Range: ${cell.min} - ${cell.max} (step: ${cell.step})`);
    } else if (cell.type === 'formula') {
        console.log(`   Type: Formula`);
        console.log(`   Formula: ${cell.formula}`);
        console.log(`   Unit: ${cell.unit}`);
        console.log(`   Decimals: ${cell.decimals}`);
    }
    console.log('');
});

console.log('='.repeat(80) + '\n');
console.log('💾 JSON Output:\n');
console.log(JSON.stringify(calculator, null, 2));

console.log('\n✅ Test completed successfully!');
