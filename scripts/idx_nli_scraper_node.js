const { chromium } = require('playwright');
const fs = require('fs');

async function scrapeNLI() {
    console.log("============================================================");
    console.log("IDX NLI SCRAPER (Node.js/Playwright)");
    console.log("Target: https://idx.co.id/id/perusahaan-tercatat/aktivitas-pencatatan");
    console.log("============================================================");

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        locale: "id-ID"
    });

    const page = await context.newPage();
    const collectedResponses = [];

    page.on('response', async (response) => {
        if (response.status() === 200) {
            const ct = response.headers()['content-type'] || '';
            if (ct.includes('json')) {
                try {
                    const body = await response.json();
                    if (
                        response.url().toLowerCase().includes('nli') ||
                        response.url().toLowerCase().includes('listing') ||
                        response.url().toLowerCase().includes('aktivitas') ||
                        JSON.stringify(body).length > 500
                    ) {
                        console.log(`    [API intercepted] ${response.url().substring(0, 80)}`);
                        collectedResponses.push({ url: response.url(), data: body });
                    }
                } catch (e) {
                    // Ignore errors parsing json
                }
            }
        }
    });

    console.log("\n[→] Navigasi ke URL...");
    try {
        await page.goto("https://idx.co.id/id/perusahaan-tercatat/aktivitas-pencatatan", { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(5000); // Wait an extra 5 seconds for client-side rendering
    } catch (e) {
        console.log("Timeout navigasi, melanjutkan dengan data yang tertangkap...");
    }

    console.log("\n[→] Mencari elemen data di halaman...");
    await page.screenshot({ path: 'idx_aktivitas_node.png' });
    console.log("    [✓] Screenshot disimpan: idx_aktivitas_node.png");

    let nliRecords = [];

    // Parse responses
    for (const resp of collectedResponses) {
        let data = resp.data;
        let rows = [];

        if (Array.isArray(data)) {
            rows = data;
        } else if (data && typeof data === 'object') {
            rows = data.data?.rows || data.rows || data.Data || data.results || [];
        }

        if (rows.length > 0) {
            console.log(`\n[✓] Data ditemukan di: ${resp.url}`);
            console.log(`    Jumlah records: ${rows.length}`);
            nliRecords.push(...rows);
        }
    }

    if (nliRecords.length > 0) {
        fs.writeFileSync('idx_nli_data_node.json', JSON.stringify(nliRecords, null, 2));
        console.log(`\n[✓] Data berhasil diekstrak dan disimpan ke: idx_nli_data_node.json`);
        console.log(`    Contoh keys record pertama: ${Object.keys(nliRecords[0]).join(', ')}`);
        
        // Cek apakah ada kolom oversubscription (OS)
        const sampleKeys = JSON.stringify(Object.keys(nliRecords[0])).toLowerCase();
        if (sampleKeys.includes('oversubscription') || sampleKeys.includes('os') || sampleKeys.includes('pesanan')) {
             console.log("    [!] SEPERTINYA TERDAPAT DATA OVERSUBSCRIPTION (OS) DI DALAMNYA!");
        } else {
             console.log("    [~] Tidak ada field dengan nama 'oversubscription' yang terdeteksi secara eksplisit.");
        }
    } else {
        console.log("\n[!] Tidak ada data yang berhasil diekstrak dari API JSON. Mungkin elemen ada di HTML?");
    }

    await browser.close();
}

scrapeNLI();
