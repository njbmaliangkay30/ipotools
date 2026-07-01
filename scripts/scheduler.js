const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);

const cronExpression = '0 9 * * *';
const timezone = 'Asia/Jakarta';
const pythonExe = process.platform === 'win32'
  ? path.join(__dirname, 'prospectus_scraper', 'venv', 'Scripts', 'python.exe')
  : path.join(__dirname, 'prospectus_scraper', 'venv', 'bin', 'python');

console.log(`[Scheduler] Cron job diaktifkan: Menjalankan scraper setiap jam 09:00 WIB (${timezone})`);

cron.schedule(cronExpression, async () => {
  console.log(`\n[Scheduler] ⏰ Waktu menunjukkan pukul 09:00 WIB. Memulai proses auto-scrape...`);
  
  try {
      console.log(`\n--- [1/2] Menjalankan E-IPO Scraper (Python + Google GenAI) ---`);
      const eipoScriptPath = path.join(__dirname, 'prospectus_scraper', 'main.py');
      const { stdout: stdout1, stderr: stderr1 } = await execPromise(`"${pythonExe}" "${eipoScriptPath}"`, { maxBuffer: 1024 * 1024 * 10 });
      if (stderr1) console.error(`[E-IPO Warning] ${stderr1}`);
      console.log(stdout1);

      console.log(`\n--- [2/2] Menjalankan IDX NLI Scraper (Oversubscription) ---`);
      const nliScriptPath = path.join(__dirname, 'run_scraper.js');
      const years = '2024,2025,2026';
      const { stdout: stdout2, stderr: stderr2 } = await execPromise(`node "${nliScriptPath}" ${years}`, { maxBuffer: 1024 * 1024 * 10 });
      if (stderr2) console.error(`[IDX Warning] ${stderr2}`);
      console.log(stdout2);

      console.log(`[Scheduler] ✅ Seluruh proses sinkronisasi pagi telah selesai!`);
  } catch (error) {
      console.error(`[Scheduler] ❌ Gagal menjalankan sinkronisasi: ${error.message}`);
  }
}, {
  scheduled: true,
  timezone: timezone
});
