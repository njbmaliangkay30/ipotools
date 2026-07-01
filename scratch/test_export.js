const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const pdf = require('pdf-parse');

// Salin fungsi dari pdf_extractor_v2.js untuk test LABS
const { extractInsiderCost, extractUseOfProceeds } = require('./pdf_extractor_v2.js'); // Wait, pdf_extractor_v2.js tidak meng-export fungsi secara default. Kita tulis ulang saja filenya untuk mendukung export agar modular.
