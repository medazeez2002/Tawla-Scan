# Script to initialize MySQL database
# Run this after MySQL is installed and running

$mysqlPath = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql"
$dbFile = ".\database.sql"
$password = "root123"  # Change this if you set a different password

Write-Host "🗄️  Initializing Tawla Scan Database..." -ForegroundColor Cyan

# Check if MySQL exists
if (-Not (Test-Path $mysqlPath)) {
    Write-Host "❌ MySQL not found at $mysqlPath" -ForegroundColor Red
    Write-Host "Please install MySQL first" -ForegroundColor Yellow
    exit 1
}

# Check if database.sql exists
if (-Not (Test-Path $dbFile)) {
    Write-Host "❌ database.sql not found" -ForegroundColor Red
    exit 1
}

# Run the SQL file
Write-Host "📝 Creating database and tables..." -ForegroundColor Yellow
& $mysqlPath -u root -p$password < $dbFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Database initialized successfully!" -ForegroundColor Green
    Write-Host "" 
    Write-Host "📊 Database: tawla_scan" -ForegroundColor Green
    Write-Host "👤 User: root" -ForegroundColor Green
    Write-Host "🔑 Password: $password" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to initialize database" -ForegroundColor Red
    exit 1
}
