const fs = require('fs');
const text = fs.readFileSync('C:/Users/malia/.gemini/antigravity/scratch/ipo-decision-tool/BACH_extracted_text.txt', 'utf8');

const start = 51450;
const end = 53500;

console.log("=== Isi Teks BACH Index 51450 - 53500 ===");
console.log(text.substring(start, end));
