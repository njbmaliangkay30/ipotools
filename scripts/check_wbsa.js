const { chromium } = require('playwright');
const fs = require('fs');
const pdf = require('pdf-parse');

async function checkWBSA() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0",
        ignoreHTTPSErrors: true
    });
    const page = await context.newPage();
    await page.goto("https://www.idx.co.id/en/market-data/statistical-reports/new-listing-information/");
    
    const url = "https://www.idx.co.id/Media/rlkf5f2n/nli-260410_wbsa_d.pdf";
    
    const base64Data = await page.evaluate(async (url) => {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    }, url);
    
    const base64Content = base64Data.split(',')[1];
    const dataBuffer = Buffer.from(base64Content, 'base64');
    
    const pdfData = await pdf(dataBuffer);
    fs.writeFileSync('wbsa_text.txt', pdfData.text);
    console.log("Saved WBSA text to wbsa_text.txt");
    await browser.close();
}

checkWBSA();
