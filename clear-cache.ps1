# Clear webpack and build caches
Write-Host "Clearing caches..." -ForegroundColor Yellow

# Remove cache directories
Remove-Item -Path "node_modules\.cache" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path ".cache" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "build" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Cache cleared successfully!" -ForegroundColor Green
Write-Host "Now restart your dev server with: npm start" -ForegroundColor Cyan
