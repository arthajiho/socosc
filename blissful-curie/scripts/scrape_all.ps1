# PowerShell recipe scraper for www.thesocsoc.com
$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

# Load System.Web assembly just in case, but use System.Net.WebUtility which is always present
Add-Type -AssemblyName System.Web -ErrorAction SilentlyContinue

$outputDir = "c:\Users\user\Documents\antigravity\blissful-curie\data"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}
$outputFile = Join-Path $outputDir "recipes.json"

Write-Host "=========================================="
Write-Host "SOCSOC Formula Database Scraper Starting..."
Write-Host "=========================================="

$headers = @{ 
    "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" 
}

$allPosts = [System.Collections.Generic.List[PSCustomObject]]::new()
$seenUids = [System.Collections.Generic.HashSet[string]]::new()
$maxPage = 27

Write-Host "Step 1: Collecting list of formulas across all 27 pages..."

for ($p = 1; $p -le $maxPage; $p++) {
    $listUrl = "https://www.thesocsoc.com/?pageid=$p&mod=list"
    try {
        $resp = Invoke-WebRequest -Uri $listUrl -Headers $headers -UseBasicParsing -TimeoutSec 20
        $html = $resp.Content
        
        # Match any document links: href="...uid=123..."
        $docMatches = [regex]::Matches($html, '(?s)<a[^>]*href="[^"]*uid=(\d+)[^"]*"[^>]*>(.*?)</a>')
        $pageFound = 0
        foreach ($m in $docMatches) {
            $uid = $m.Groups[1].Value
            $inner = $m.Groups[2].Value
            if ($inner -match 'kboard-default-cut-strings') {
                $titleRaw = [regex]::Replace($inner, '<[^>]+>', '').Trim()
                $titleClean = [System.Net.WebUtility]::HtmlDecode($titleRaw)
                if (-not $seenUids.Contains($uid) -and $titleClean.Length -gt 1) {
                    $seenUids.Add($uid) | Out-Null
                    $allPosts.Add([PSCustomObject]@{
                        uid = $uid
                        title = $titleClean
                        url = "https://www.thesocsoc.com/?mod=document&uid=$uid"
                    })
                    $pageFound++
                }
            }
        }
        Write-Host " - Page $p / ${maxPage} - found $pageFound recipes. (Total cumulative: $($allPosts.Count))"
    } catch {
        Write-Host " ! Page $p failed: $($_.Exception.Message)"
    }
    Start-Sleep -Milliseconds 200
}

Write-Host "`nTotal $($allPosts.Count) unique formulas found."
Write-Host "Step 2: Fetching formula details, ingredients, and procedure...`n"

$patSupplier = [char]0xC81C + [char]0xACF5 + [char]0xC0AC
$patCode = [char]0xCC98 + [char]0xBC29 + [char]0xBC88 + [char]0xD638
$patDesc = [char]0xC81C + [char]0xD615 + [char]0xC124 + [char]0xBA85
$patProc = [char]0xC81C + [char]0xC870 + [char]0xACF5 + [char]0xC815

$results = [System.Collections.Generic.List[PSCustomObject]]::new()
$counter = 0

foreach ($post in $allPosts) {
    $counter++
    try {
        $detailResp = Invoke-WebRequest -Uri $post.url -Headers $headers -UseBasicParsing -TimeoutSec 20
        $html = $detailResp.Content

        # Category
        $catMatch = [regex]::Match($html, 'detail-category1">[\s\S]*?<div class="detail-name">([^<]+)</div>')
        $category = if ($catMatch.Success) { $catMatch.Groups[1].Value.Trim() } else { "etc" }

        # Supplier
        $supRegex = [regex]($patSupplier + '\s*</strong>\s*:\s*([^<]+)')
        $supMatch = $supRegex.Match($html)
        $supplier = if ($supMatch.Success) { [System.Net.WebUtility]::HtmlDecode($supMatch.Groups[1].Value.Trim()) } else { "" }

        # Formula Code
        $codeRegex = [regex]($patCode + '\s*</strong>\s*:\s*([^<]+)')
        $codeMatch = $codeRegex.Match($html)
        $formulaCode = if ($codeMatch.Success) { [System.Net.WebUtility]::HtmlDecode($codeMatch.Groups[1].Value.Trim()) } else { "" }

        # Description
        $descRegex = [regex]($patDesc + '\s*</strong>\s*:\s*([^<]+)')
        $descMatch = $descRegex.Match($html)
        $description = if ($descMatch.Success) { [System.Net.WebUtility]::HtmlDecode($descMatch.Groups[1].Value.Trim()) } else { "" }

        # Ingredients Table
        $ingredients = [System.Collections.Generic.List[PSCustomObject]]::new()
        $tableMatch = [regex]::Match($html, '(?s)<table[^>]*>(.*?)</table>')
        if ($tableMatch.Success) {
            $tableHtml = $tableMatch.Groups[1].Value
            $rows = [regex]::Matches($tableHtml, '(?s)<tr[^>]*>(.*?)</tr>')
            foreach ($row in $rows) {
                $cells = [regex]::Matches($row.Groups[1].Value, '(?s)<td[^>]*>(.*?)</td>')
                if ($cells.Count -ge 4) {
                    $cTexts = @()
                    foreach ($c in $cells) {
                        $clean = [regex]::Replace($c.Groups[1].Value, '<[^>]+>', '').Trim()
                        $clean = [System.Net.WebUtility]::HtmlDecode($clean)
                        $cTexts += $clean
                    }

                    if ($cTexts[0] -match "Phase" -and $cTexts[1] -match "Ingredient") { continue }

                    $phase = $cTexts[0]
                    $ingName = $cTexts[1]
                    $inci = if ($cells.Count -ge 5) { $cTexts[2] } else { "" }
                    $pctStr = if ($cells.Count -ge 5) { $cTexts[3] } else { $cTexts[2] }
                    $rowSup = if ($cells.Count -ge 5) { $cTexts[4] } else { if ($cells.Count -ge 4) { $cTexts[3] } else { "" } }

                    $pctClean = $pctStr -replace '[^\d\.,]', '' -replace ',', '.'
                    $pctVal = 0.0
                    [double]::TryParse($pctClean, [ref]$pctVal) | Out-Null

                    $ingredients.Add([PSCustomObject]@{
                        phase = $phase
                        name = $ingName
                        inci = $inci
                        percent = $pctVal
                        percentText = $pctStr
                        supplier = $rowSup
                    })
                }
            }
        }

        # Procedure
        $procRegex = [regex]('(?s)' + $patProc + '\s*(?:<[^>]+>\s*)*([\s\S]*?)(?:\[|Disclaimer|$)')
        $procMatch = $procRegex.Match($html)
        $procedure = ""
        if ($procMatch.Success) {
            $procRaw = $procMatch.Groups[1].Value
            $procClean = [regex]::Replace($procRaw, '<[^>]+>', "`n").Trim()
            $procLines = ($procClean -split "`n") | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
            $procedure = ($procLines -join "`n")
        }

        $results.Add([PSCustomObject]@{
            uid = $post.uid
            title = $post.title
            category = $category
            supplier = $supplier
            formulaCode = $formulaCode
            description = $description
            ingredients = $ingredients
            procedure = $procedure
            sourceUrl = $post.url
        })

        if ($counter % 20 -eq 0 -or $counter -eq $allPosts.Count) {
            Write-Host " >> [$counter / $($allPosts.Count)] Processed: $($post.title)"
        }
    } catch {
        Write-Host " ! UID $($post.uid) error: $($_.Exception.Message)"
    }
}

# Save JSON
$json = $results | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($outputFile, $json, [System.Text.Encoding]::UTF8)

Write-Host "`n=========================================="
Write-Host "SUCCESS! Scraped $($results.Count) recipes."
Write-Host "Output File: $outputFile"
Write-Host "=========================================="
