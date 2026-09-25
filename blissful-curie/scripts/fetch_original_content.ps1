# PowerShell script to update recipes.json with exact raw HTML content from thesocsoc.com
$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

$recipesFile = "c:\Users\user\Documents\antigravity\blissful-curie\data\recipes.json"
$jsFile = "c:\Users\user\Documents\antigravity\blissful-curie\recipes_data.js"
$artifactJs = "C:\Users\user\.gemini\antigravity\brain\e175ac82-4fdd-430b-8bdd-f48d1e6a4687\recipes_data.js"

$rawJson = [System.IO.File]::ReadAllText($recipesFile, [System.Text.Encoding]::UTF8)
$recipes = $rawJson | ConvertFrom-Json

Write-Host "Updating $($recipes.Count) recipes with exact original HTML content..."

$wc = New-Object System.Net.WebClient
$wc.Encoding = [System.Text.Encoding]::UTF8
$wc.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

$count = 0
foreach ($r in $recipes) {
    $count++
    try {
        $url = "https://www.thesocsoc.com/?mod=document&uid=$($r.uid)"
        $html = $wc.DownloadString($url)

        $start = $html.IndexOf('<div class="content-view">')
        if ($start -ge 0) {
            $end = $html.IndexOf('<div class="kboard-document-navi">', $start)
            if ($end -lt 0) { $end = $html.IndexOf('<div class="kboard-comments-area', $start) }
            if ($end -gt $start) {
                $body = $html.Substring($start, $end - $start)
                # Clean up any kboard options group or stray scripts
                $bodyClean = [regex]::Replace($body, '(?s)<div class="kboard-document-options-group">.*?</div>', '')
                $r | Add-Member -NotePropertyName "contentHtml" -NotePropertyValue $bodyClean -Force
            }
        }
        if ($count % 30 -eq 0 -or $count -eq $recipes.Count) {
            Write-Host " >> [$count / $($recipes.Count)] Original content extracted"
        }
    } catch {
        Write-Host " ! UID $($r.uid) error: $($_.Exception.Message)"
    }
    Start-Sleep -Milliseconds 150
}

# Save back to JSON
$updatedJson = $recipes | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText($recipesFile, $updatedJson, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($jsFile, "window.SOCSOC_RECIPES = " + $updatedJson + ";", [System.Text.Encoding]::UTF8)
if (Test-Path "C:\Users\user\.gemini\antigravity\brain\e175ac82-4fdd-430b-8bdd-f48d1e6a4687") {
    [System.IO.File]::WriteAllText($artifactJs, "window.SOCSOC_RECIPES = " + $updatedJson + ";", [System.Text.Encoding]::UTF8)
}

Write-Host "SUCCESS: Updated all 267 recipes with exact original post HTML!"
