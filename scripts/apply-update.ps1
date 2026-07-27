param(
    [Parameter(Mandatory=$true)]
    [string]$ZipPath
)

$repoRoot = Split-Path -Parent $PSScriptRoot

if (-not (Test-Path $ZipPath)) {
    Write-Host "Arquivo nao encontrado: $ZipPath" -ForegroundColor Red
    exit 1
}

Write-Host "Extraindo '$ZipPath' para '$repoRoot'..." -ForegroundColor Cyan
Expand-Archive -Path $ZipPath -DestinationPath $repoRoot -Force

Write-Host "`nFeito. Estado atual do repositorio:" -ForegroundColor Green
Set-Location $repoRoot
git status

Write-Host "`nRevise as mudancas acima. Se estiver tudo certo, rode:" -ForegroundColor Yellow
Write-Host "  git add -A" -ForegroundColor Yellow
Write-Host "  git commit -m `"sua mensagem aqui`"" -ForegroundColor Yellow
Write-Host "  git push" -ForegroundColor Yellow
