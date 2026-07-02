const { exec } = require('child_process');
const path = require('path');

const yearsInput = process.argv[2] || '2026';

const pythonExe = process.platform === 'win32'
  ? path.join(__dirname, 'prospectus_scraper', 'venv', 'Scripts', 'python.exe')
  : path.join(__dirname, 'prospectus_scraper', 'venv', 'bin', 'python');

const scriptPath = path.join(__dirname, 'prospectus_scraper', 'nli_scraper.py');

console.log(`[Wrapper] Executing Python NLI Scraper: "${pythonExe}" "${scriptPath}" --years ${yearsInput}`);

exec(`"${pythonExe}" "${scriptPath}" --years ${yearsInput}`, {
  maxBuffer: 1024 * 1024 * 10
}, (err, stdout, stderr) => {
  if (err) {
    console.error(`[Wrapper Error]: ${err.message}`);
    process.exit(1);
  }
  
  // Forward python stdout to Node's stdout
  console.log(stdout);
});
