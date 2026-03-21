# BetGuess Deploy Script
# Kullanim: .\deploy.ps1
# Secenekler:
#   .\deploy.ps1              -> Tum projeyi deploy eder (client + server)
#   .\deploy.ps1 -ServerOnly  -> Sadece server deploy eder
#   .\deploy.ps1 -ClientOnly  -> Sadece client deploy eder

param(
    [switch]$ServerOnly,
    [switch]$ClientOnly
)

$ErrorActionPreference = "Stop"

# Sunucu bilgileri
$SSH_HOST = "tepe@192.168.1.100"
$SSH_PORT = "2222"
$REMOTE_DIR = "~/betguess"
$PROJECT_DIR = $PSScriptRoot

function Write-Step($msg) {
    Write-Host "`n[$((Get-Date).ToString('HH:mm:ss'))] $msg" -ForegroundColor Cyan
}

function Write-Success($msg) {
    Write-Host "  ✅ $msg" -ForegroundColor Green
}

function Write-Fail($msg) {
    Write-Host "  ❌ $msg" -ForegroundColor Red
    exit 1
}

function SSH-Run($cmd) {
    ssh -p $SSH_PORT $SSH_HOST $cmd
    if ($LASTEXITCODE -ne 0) { Write-Fail "SSH komutu basarisiz: $cmd" }
}

# ===== CLIENT DEPLOY =====
function Deploy-Client {
    Write-Step "Client build ediliyor..."
    Push-Location "$PROJECT_DIR\client"
    npm run build
    if ($LASTEXITCODE -ne 0) { Write-Fail "Client build basarisiz!" }
    Pop-Location
    Write-Success "Client build tamam"

    Write-Step "Client dosyalari sunucuya gonderiliyor..."
    SSH-Run "rm -rf $REMOTE_DIR/client/dist"
    SSH-Run "mkdir -p $REMOTE_DIR/client"
    scp -P $SSH_PORT -r "$PROJECT_DIR\client\dist" "${SSH_HOST}:${REMOTE_DIR}/client/"
    if ($LASTEXITCODE -ne 0) { Write-Fail "Client dosya transferi basarisiz!" }
    Write-Success "Client dosyalari gonderildi"
}

# ===== SERVER DEPLOY =====
function Deploy-Server {
    Write-Step "Server dosyalari sunucuya gonderiliyor..."
    # Kaynak dosyalarini gonder
    scp -P $SSH_PORT -r "$PROJECT_DIR\server\src" "${SSH_HOST}:${REMOTE_DIR}/server/"
    scp -P $SSH_PORT "$PROJECT_DIR\server\package.json" "$PROJECT_DIR\server\package-lock.json" "$PROJECT_DIR\server\tsconfig.json" "${SSH_HOST}:${REMOTE_DIR}/server/"
    if ($LASTEXITCODE -ne 0) { Write-Fail "Server dosya transferi basarisiz!" }
    Write-Success "Server dosyalari gonderildi"

    Write-Step "Sunucuda npm install yapiliyor..."
    SSH-Run "cd $REMOTE_DIR/server && npm install --production=false 2>&1 | tail -3"
    Write-Success "npm install tamam"

    Write-Step "Sunucuda TypeScript build yapiliyor..."
    SSH-Run "cd $REMOTE_DIR/server && npx tsc 2>&1"
    Write-Success "TypeScript build tamam"

    Write-Step "PM2 ile sunucu yeniden baslatiliyor..."
    SSH-Run "pm2 restart betguess 2>&1"
    Write-Success "Sunucu yeniden baslatildi"
}

# ===== ANA AKIS =====
Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  BetGuess Deploy Script" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  Sunucu: $SSH_HOST`:$SSH_PORT" -ForegroundColor DarkGray
Write-Host "  Hedef:  $REMOTE_DIR" -ForegroundColor DarkGray

$startTime = Get-Date

if ($ClientOnly) {
    Write-Host "  Mod:    Sadece Client" -ForegroundColor DarkGray
    Deploy-Client
} elseif ($ServerOnly) {
    Write-Host "  Mod:    Sadece Server" -ForegroundColor DarkGray
    Deploy-Server
} else {
    Write-Host "  Mod:    Tam Deploy (Client + Server)" -ForegroundColor DarkGray
    Deploy-Client
    Deploy-Server
}

# Health check
Write-Step "Health check yapiliyor (sunucunun baslamasi icin 5 sn bekleniyor)..."
Start-Sleep -Seconds 5
$health = SSH-Run "curl -s http://localhost:3002/api/health 2>&1"
if ($health -match '"ok"') {
    Write-Success "Health check basarili: $health"
} else {
    Write-Fail "Health check basarisiz: $health"
}

$elapsed = ((Get-Date) - $startTime).TotalSeconds
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  ✅ Deploy tamamlandi! ($([math]::Round($elapsed))s)" -ForegroundColor Green
Write-Host "  🌐 https://betguess.mytepeapi.com.tr" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green
