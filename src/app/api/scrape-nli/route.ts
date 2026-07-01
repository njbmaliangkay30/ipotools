import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';

const execPromise = util.promisify(exec);

export async function GET(request: Request) {
  try {
    const eipoScriptPath = path.join(process.cwd(), 'scripts', 'prospectus_scraper', 'main.py');
    const nliScriptPath = path.join(process.cwd(), 'scripts', 'run_scraper.js');
    const years = '2024,2025,2026';

    const pythonExe = process.platform === 'win32'
      ? path.join(process.cwd(), 'scripts', 'prospectus_scraper', 'venv', 'Scripts', 'python.exe')
      : path.join(process.cwd(), 'scripts', 'prospectus_scraper', 'venv', 'bin', 'python');

    console.log(`[API] Menjalankan E-IPO Scraper (Python + Google GenAI)...`);
    const { stdout: stdout1, stderr: stderr1 } = await execPromise(`"${pythonExe}" "${eipoScriptPath}"`, {
      timeout: 900000, 
      maxBuffer: 1024 * 1024 * 10
    });
    
    console.log(`[API] Menjalankan IDX NLI Scraper...`);
    const { stdout: stdout2, stderr: stderr2 } = await execPromise(`node "${nliScriptPath}" ${years}`, {
      timeout: 900000, 
      maxBuffer: 1024 * 1024 * 10
    });
    
    // Parse result dari stdout2 (NLI Scraper) karena NLI berjalan terakhir
    const lines = stdout2.trim().split('\n');
    let result = { success: true, count: 0 };
    
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].startsWith('__RESULT__=')) {
            try {
                result = JSON.parse(lines[i].replace('__RESULT__=', ''));
                break;
            } catch (e) {}
        }
    }

    return NextResponse.json({
        success: true, 
        message: "Kedua scraper (E-IPO & NLI) berhasil dieksekusi secara manual",
        nli_count: result.count
    });

  } catch (error: any) {
    console.error("API Route Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
