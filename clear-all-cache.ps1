Write-Host "Clearing all caches for TallyCatalyst..." -ForegroundColor Cyan

# Clear node_modules cache
Write-Host "`nClearing node_modules cache..." -ForegroundColor Yellow
Remove-Item -Path "node_modules\.cache" -Recurse -Force -ErrorAction SilentlyContinue

# Clear build directory
Write-Host "Clearing build directory..." -ForegroundColor Yellow
Remove-Item -Path "build" -Recurse -Force -ErrorAction SilentlyContinue

# Clear webpack cache
Write-Host "Clearing webpack cache..." -ForegroundColor Yellow
Remove-Item -Path ".cache" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "`nAll caches cleared successfully!" -ForegroundColor Green
Write-Host "`nNext: Clear Chrome cache and restart dev server" -ForegroundColor Cyan
