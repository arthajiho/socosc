# Filter recipes to exactly 5 per category and format percentages to 2 decimals
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$recipesFile = "c:\Users\user\Documents\antigravity\blissful-curie\data\recipes.json"
$jsFile = "c:\Users\user\Documents\antigravity\blissful-curie\recipes_data.js"
$artifactJs = "C:\Users\user\.gemini\antigravity\brain\e175ac82-4fdd-430b-8bdd-f48d1e6a4687\recipes_data.js"

$raw = [System.IO.File]::ReadAllText($recipesFile, [System.Text.Encoding]::UTF8)
$data = $raw | ConvertFrom-Json

$categories = @("skin care", "sun care", "body", "hair", "make up")
$selected = [System.Collections.Generic.List[PSCustomObject]]::new()

foreach ($cat in $categories) {
    $inCat = $data | Where-Object { $_.category -eq $cat }
    $top5 = $inCat | Select-Object -First 5
    Write-Host "Category [$cat]: selected $($top5.Count) items"
    foreach ($item in $top5) {
        # Format ingredients percent to 2 decimal places
        if ($item.ingredients) {
            foreach ($ing in $item.ingredients) {
                if ($ing.percent -ne $null) {
                    $ing.percent = [Math]::Round([double]$ing.percent, 2)
                    $ing.percentText = ([double]$ing.percent).ToString("F2")
                }
            }
        }
        $selected.Add($item)
    }
}

Write-Host "Total selected: $($selected.Count) recipes."

$jsonOut = $selected | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText($recipesFile, $jsonOut, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($jsFile, "window.SOCSOC_RECIPES = " + $jsonOut + ";", [System.Text.Encoding]::UTF8)
if (Test-Path "C:\Users\user\.gemini\antigravity\brain\e175ac82-4fdd-430b-8bdd-f48d1e6a4687") {
    [System.IO.File]::WriteAllText($artifactJs, "window.SOCSOC_RECIPES = " + $jsonOut + ";", [System.Text.Encoding]::UTF8)
}

Write-Host "Done! Saved 25 recipes with 2-decimal percentages."
