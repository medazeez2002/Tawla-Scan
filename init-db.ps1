# Script to initialize MySQL database
# Run this after MySQL is installed and running

param(
    [switch]$Reset
)

$mysqlPath = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
$dbFile = ".\database.sql"
$password = "root123"  # Change this if you set a different password

Write-Host "[DB] Initializing Tawla Scan Database..." -ForegroundColor Cyan

# Check if MySQL exists
if (-not (Test-Path $mysqlPath)) {
    Write-Host "[ERROR] MySQL not found at $mysqlPath" -ForegroundColor Red
    Write-Host "Please install MySQL first" -ForegroundColor Yellow
    exit 1
}

# Check if database.sql exists
if (-not (Test-Path $dbFile)) {
    Write-Host "[ERROR] database.sql not found" -ForegroundColor Red
    exit 1
}

# Run the SQL file
Write-Host "[INFO] Creating database and tables..." -ForegroundColor Yellow
if ($Reset) {
    Write-Host "[WARN] Reset enabled: dropping existing tawla_scan database" -ForegroundColor Yellow
    & $mysqlPath -u root --password=$password -e "DROP DATABASE IF EXISTS tawla_scan;"
}
Get-Content -Raw $dbFile | & $mysqlPath -u root --password=$password

if ($LASTEXITCODE -eq 0) {
    Write-Host "[SUCCESS] Database initialized successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "[DB] Database: tawla_scan" -ForegroundColor Green
    Write-Host "[DB] User: root" -ForegroundColor Green
    Write-Host "[DB] Password: $password" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Failed to initialize database" -ForegroundColor Red
    exit 1
}
