$scraper = 'scripts\run_eipo_scraper.js'
$lines = Get-Content $scraper
$out = [System.Collections.Generic.List[string]]::new()

$i = 0
$skip = $false
foreach ($line in $lines) {
    $i++
    if ($i -eq 537) {
        # Insert the rebuilt loop
        $out.Add('                                         for (const line of allLines) {')
        $out.Add('                                              const isEndSection = /^\s*(?:\d+[\.\s]+|[IVXLC]+\s*[\.\s]+)?(?:STRUKTUR\s+PERMODALAN|IKHTISAR\s+DATA\s+KEUANGAN|KEBIJAKAN\s+DIVIDEN|RISIKO\s+USAHA)/i.test(line) && line.length < 60;')
        $out.Add('                                              if (isEndSection) break;')
        $out.Add('')
        $out.Add('                                              if (/^\s*\d+\s*[)\.]/i.test(line) && !isNumberedList) isNumberedList = true;')
        $out.Add('')
        $out.Add('                                              let isNewItem;')
        $out.Add('                                              if (isNumberedList) {')
        $out.Add('                                                  isNewItem = /^(?:\d+\s*[)\.]|sisanya\s+akan|sisa\s+dana)/i.test(line);')
        $out.Add('                                              } else {')
        $out.Add('                                                  isNewItem = /^(?:[\d]+[)\.]|[-*\u2022]|[a-f]\.|sekitar\s+[\d%,]+|sisanya\s+akan)/i.test(line);')
        $out.Add('                                              }')
        $out.Add('')
        $out.Add('                                              if (isNewItem) {')
        $out.Add('                                                  if (currentItem) items.push(currentItem);')
        $out.Add('                                                  currentItem = line;')
        $out.Add('                                              } else {')
        $out.Add('                                                  currentItem = currentItem ? currentItem + " " + line : line;')
        $out.Add('                                              }')
        $out.Add('                                         }')
        $skip = $true
    } elseif ($skip -and $i -le 545) {
        # Skip the broken lines 538-545
    } else {
        $skip = $false
        $out.Add($line)
    }
}

$out | Set-Content $scraper
Write-Host "Done. Total lines: $($out.Count)"
