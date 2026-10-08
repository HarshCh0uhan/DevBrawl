# ──────────────────────────────────────────────────────────────────────────────
# DevBrawl - Local Development Startup Script (PowerShell for Windows)
# ──────────────────────────────────────────────────────────────────────────────

param(
    [switch]$NoDocker
)

Write-Host "🚀 Starting DevBrawl locally..." -ForegroundColor Green

# Check for Docker
if (-not $NoDocker) {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Host "❌ Docker not found. Please install Docker Desktop." -ForegroundColor Red
        exit 1
    }
    
    if (-not (Get-Command "docker compose" -ErrorAction SilentlyContinue)) {
        Write-Host "❌ Docker Compose not found." -ForegroundColor Red
        exit 1
    }
}

# Check for .env files
if (-not (Test-Path "Backend/.env")) {
    Write-Host "📝 Creating Backend/.env from template..." -ForegroundColor Yellow
    Copy-Item "Backend/.env.example" "Backend/.env"
    Write-Host "⚠️  Please edit Backend/.env with your API keys before continuing!" -ForegroundColor Yellow
    Write-Host "   Required: GEMINI_API_KEY, MONGODB_URI, JWT_SECRET" -ForegroundColor Yellow
    Read-Host "Press Enter after editing .env to continue..."
}

if (-not (Test-Path "Frontend/.env.local")) {
    Write-Host "📝 Creating Frontend/.env.local from template..." -ForegroundColor Yellow
    Copy-Item "Frontend/.env.example" "Frontend/.env.local"
}

if (-not $NoDocker) {
    # Start services
    Write-Host "🐳 Starting Docker services (MongoDB + Piston)..." -ForegroundColor Cyan
    docker compose up -d mongodb piston
    
    # Wait for services
    Write-Host "⏳ Waiting for services to be healthy..." -ForegroundColor Yellow
    Start-Sleep -Seconds 15
    
    # Check health
    Write-Host "🔍 Checking service health..." -ForegroundColor Cyan
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:2000/health" -TimeoutSec 5
        Write-Host "✅ Piston is ready" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Piston not responding yet, continuing anyway..." -ForegroundColor Yellow
    }
}

# Start backend
Write-Host "🔧 Starting Backend..." -ForegroundColor Cyan
Set-Location Backend
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing backend dependencies..." -ForegroundColor Yellow
    npm install
}
$backendProcess = Start-Process "npm" -ArgumentList "run dev" -PassThru -WorkingDirectory (Get-Location)
Set-Location ..

# Start frontend
Write-Host "🎨 Starting Frontend..." -ForegroundColor Cyan
Set-Location Frontend
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing frontend dependencies..." -ForegroundColor Yellow
    npm install
}
$frontendProcess = Start-Process "npm" -ArgumentList "run dev" -PassThru -WorkingDirectory (Get-Location)
Set-Location ..

Write-Host ""
Write-Host "✅ DevBrawl is running!" -ForegroundColor Green
Write-Host ""
Write-Host "📱 Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "🔧 Backend API: http://localhost:8000" -ForegroundColor Cyan
if (-not $NoDocker) {
    Write-Host "⚙️  Piston API: http://localhost:2000" -ForegroundColor Cyan
    Write-Host "🍃 MongoDB: mongodb://localhost:27017" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow

# Wait for user to stop
try {
    Wait-Process -Id $backendProcess.Id, $frontendProcess.Id -ErrorAction SilentlyContinue
} catch {
    # Ignore
}

# Cleanup on exit
Write-Host "🛑 Stopping services..." -ForegroundColor Yellow
Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue

if (-not $NoDocker) {
    docker compose down
}

Write-Host "✅ Stopped." -ForegroundColor Green