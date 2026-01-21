$ErrorActionPreference = "Stop"

$apiKey = "AIzaSyC7izvCKz66BNImMbNAD3r2pOfplO-lCmQ"
$modelUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$apiKey"
$requestFile = "C:\Users\fires\OneDrive\Git\QlikModelBuilder\vscode-extension\test\STAGE1\gemini-request.json"

Write-Host "=== Gemini Test Plan Review ===" -ForegroundColor Cyan
Write-Host ""

# Read request body
$body = Get-Content -Path $requestFile -Raw

Write-Host "Sending plan to Gemini 2.5 Flash..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri $modelUrl -Method POST -ContentType "application/json" -Body $body
    $result = $response.candidates[0].content.parts[0].text

    Write-Host ""
    Write-Host "=== Gemini Response ===" -ForegroundColor Green
    Write-Host $result
    Write-Host ""

    # Try to parse JSON response
    if ($result -match '\{.*\}') {
        $json = $result | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($json) {
            Write-Host "=== Scores ===" -ForegroundColor Cyan
            Write-Host "Completeness: $($json.completeness)/10" -ForegroundColor $(if($json.completeness -eq 10){"Green"}else{"Yellow"})
            Write-Host "Correctness: $($json.correctness)/10" -ForegroundColor $(if($json.correctness -eq 10){"Green"}else{"Yellow"})
            Write-Host "Status: $($json.status)" -ForegroundColor $(if($json.status -eq "APPROVED"){"Green"}else{"Red"})

            if ($json.missing -and $json.missing.Count -gt 0) {
                Write-Host ""
                Write-Host "Missing items:" -ForegroundColor Red
                $json.missing | ForEach-Object { Write-Host "  - $_" }
            }

            if ($json.recommendations -and $json.recommendations.Count -gt 0) {
                Write-Host ""
                Write-Host "Recommendations:" -ForegroundColor Yellow
                $json.recommendations | ForEach-Object { Write-Host "  - $_" }
            }
        }
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}
