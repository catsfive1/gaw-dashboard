<#
.SYNOPSIS
    Launch the Agent Modules helper daemon for the GAW Dashboard.
.DESCRIPTION
    Starts the local Python daemon (agent-modules-helper.py) that reports installed
    versions and runs allowlisted updates for the dashboard's "Agent Modules" tab.
    Binds 127.0.0.1:8791 only. Runs until you press Ctrl+C / close the window.
.EXAMPLE
    pwsh -NoProfile -ExecutionPolicy Bypass -File "D:\AI\_PROJECTS\gaw-dashboard\tools\agent-modules-helper.ps1"
.NOTES
    Version: 1.0.0  Requires: PowerShell 5.1+ and Python on PATH.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$ScriptDir = $PSScriptRoot
$Helper = Join-Path $ScriptDir 'agent-modules-helper.py'

if (-not (Test-Path $Helper)) {
    Write-Host "Helper not found: $Helper" -ForegroundColor Red
    exit 1
}

$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) {
    Write-Host 'Python not found on PATH. Install from https://python.org' -ForegroundColor Red
    exit 2
}

Write-Host 'Starting Agent Modules helper on http://127.0.0.1:8791 ...' -ForegroundColor Cyan
Write-Host 'Leave this window open. Press Ctrl+C to stop.' -ForegroundColor DarkGray

& python $Helper
exit $LASTEXITCODE
