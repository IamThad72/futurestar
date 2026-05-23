<#
.SYNOPSIS
  Dumps estate_mgmt_db and restores it to Supabase.
.DESCRIPTION
  Reads source DB from .env. Use -RestoreOnly with a dump path to restore without re-dumping.
.PARAMETER RestoreOnly
  Path to existing .sql dump file. Skips dump, restores only.
.EXAMPLE
  .\scripts\migrate-to-supabase.ps1
.EXAMPLE
  .\scripts\migrate-to-supabase.ps1 -RestoreOnly .\db-dump-20260315-100131.sql
#>
param([string]$RestoreOnly)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$DumpFile = if ($RestoreOnly) { (Resolve-Path $RestoreOnly).Path } else { Join-Path $PSScriptRoot "..\db-dump-$(Get-Date -Format 'yyyyMMdd-HHmmss').sql" }

# Load .env
$envPath = Join-Path (Split-Path $PSScriptRoot -Parent) ".env"
if (-not (Test-Path $envPath)) {
  Write-Error ".env not found at $envPath. Set DATABASE_URL (target) and DB_* (source)."
}
foreach ($line in Get-Content $envPath) {
  if ($line -match '^\s*([^#=]+)=(.*)$') {
    $key = $matches[1].Trim()
    $val = $matches[2].Trim() -replace '^["'']|["'']$'
    if (-not [Environment]::GetEnvironmentVariable($key, "Process")) {
      [Environment]::SetEnvironmentVariable($key, $val, "Process")
    }
  }
}

# Build target URL: try pooler first (often resolves better), then direct
$TargetUrl = $env:DATABASE_URL
if (-not $TargetUrl) { $TargetUrl = $env:SUPABASE_DIRECT_URL }
if (-not $TargetUrl -and $env:SUPABASE_URL -and $env:SUPABASE_DB_PASSWORD) {
  if ($env:SUPABASE_URL -match 'https?://([^.]+)\.supabase\.co') {
    $projectRef = $matches[1]
    $TargetUrl = "postgresql://postgres:$($env:SUPABASE_DB_PASSWORD)@db.$projectRef.supabase.co:5432/postgres"
  }
}
if (-not $TargetUrl) {
  Write-Error "Set DATABASE_URL, or SUPABASE_URL + SUPABASE_DB_PASSWORD in .env"
}

# Ensure SSL for Supabase
if ($TargetUrl -notmatch '\?') { $TargetUrl += "?sslmode=require" }
elseif ($TargetUrl -notmatch 'sslmode=') { $TargetUrl += "&sslmode=require" }

if (-not $RestoreOnly) {
  $DB_HOST = $env:DB_HOST
  $DB_PORT = $env:DB_PORT
  $DB_NAME = if ($env:DB_NAME) { $env:DB_NAME } else { "estate_mgmt_db" }
  $DB_USER = $env:DB_USER
  $DB_PASSWORD = $env:DB_PASSWORD
  if (-not ($DB_HOST -and $DB_PORT -and $DB_NAME -and $DB_USER)) {
    Write-Error "Missing DB_* vars for source. Set DB_HOST, DB_PORT, DB_NAME, DB_USER (and DB_PASSWORD) in .env"
  }
}

Write-Host "Target: DATABASE_URL"
Write-Host "Dump file: $DumpFile"
if (-not $RestoreOnly) { Write-Host "Source: $env:DB_HOST`:$env:DB_PORT/$($env:DB_NAME)" }
Write-Host ""

# Resolve pg_dump/psql (Windows often has them not in PATH)
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  $pgDir = "C:\Program Files\PostgreSQL"
  $found = Get-ChildItem $pgDir -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | ForEach-Object {
    $bin = Join-Path $_.FullName "bin"
    if (Test-Path "$bin\psql.exe") { $bin; break }
  } | Select-Object -First 1
  if ($found) { $env:PATH = "$found;$env:PATH" }
  else { Write-Error "psql not found. Add PostgreSQL bin to PATH or install PostgreSQL." }
}

if (-not $RestoreOnly) {
  if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
    $pgDir = "C:\Program Files\PostgreSQL"
    $found = Get-ChildItem $pgDir -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | ForEach-Object {
      $bin = Join-Path $_.FullName "bin"
      if (Test-Path "$bin\pg_dump.exe") { $bin; break }
    } | Select-Object -First 1
    if ($found) { $env:PATH = "$found;$env:PATH" }
  }
  Write-Host "Dumping source database..."
  $env:PGPASSWORD = $env:DB_PASSWORD
  $pgDumpArgs = @(
    "-h", $env:DB_HOST,
    "-p", $env:DB_PORT,
    "-U", $env:DB_USER,
    "-d", $(if ($env:DB_NAME) { $env:DB_NAME } else { "estate_mgmt_db" }),
    "-F", "p", "-f", $DumpFile,
    "--no-owner", "--no-privileges", "--no-subscriptions", "--clean"
  )
  & pg_dump @pgDumpArgs
  if ($LASTEXITCODE -ne 0) { Write-Error "pg_dump failed." }
  Write-Host "Dump saved to $DumpFile`n"
} elseif (-not (Test-Path $DumpFile)) {
  Write-Error "Dump file not found: $DumpFile"
}

# 2. Restore to target (Supabase)
Write-Host "Restoring to Supabase..."
& psql $TargetUrl -f $DumpFile
if ($LASTEXITCODE -ne 0) {
  Write-Error "psql restore failed. Check DATABASE_URL/SUPABASE_DB_PASSWORD and network."
}

# 3. Post-migration: update statistics (per Supabase docs)
Write-Host "Running VACUUM ANALYZE..."
& psql $TargetUrl -c "VACUUM VERBOSE ANALYZE;"
if ($LASTEXITCODE -ne 0) { Write-Warning "VACUUM ANALYZE had issues (non-fatal)." }

Write-Host ""
Write-Host "Migration complete. Database restored to Supabase."
