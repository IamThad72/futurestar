param(
  [Parameter(Mandatory = $true)]
  [string]$SqlServer,

  [Parameter(Mandatory = $true)]
  [string]$SqlDatabase,

  [Parameter(Mandatory = $true)]
  [string]$SqlUser,

  [Parameter(Mandatory = $true)]
  [string]$SqlPassword,

  [Parameter(Mandatory = $true)]
  [string]$PgDatabase,

  [Parameter(Mandatory = $true)]
  [string]$PgUser,

  [Parameter(Mandatory = $true)]
  [string]$PgPassword,

  [string]$PgHost = "host.docker.internal",
  [int]$PgPort = 5432
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Escape-ForUri {
  param([string]$Value)
  return [System.Uri]::EscapeDataString($Value)
}

$sourceUser = Escape-ForUri $SqlUser
$sourcePass = Escape-ForUri $SqlPassword
$targetUser = Escape-ForUri $PgUser
$targetPass = Escape-ForUri $PgPassword

$source = "mssql://${sourceUser}:${sourcePass}@${SqlServer}/${SqlDatabase}?encrypt=true&trustServerCertificate=true"
$target = "postgresql://${targetUser}:${targetPass}@${PgHost}`:${PgPort}/${PgDatabase}"

Write-Host "Starting migration from Azure SQL to Postgres..."
Write-Host "Source: ${SqlServer}/${SqlDatabase}"
Write-Host "Target: ${PgHost}:${PgPort}/${PgDatabase}"

pgloader "$source" "$target"
