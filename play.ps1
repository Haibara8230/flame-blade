# ============================================================
#  《命运》DESTINY — 本地启动脚本
#  用 PowerShell 启动一个静态服务器（ES Module 不能直接用 file:// 打开）
# ============================================================
param([int]$Port = 8123)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ''
Write-Host '  ============================================' -ForegroundColor DarkYellow
Write-Host '    炎 之 刃  ·  FLAME  BLADE' -ForegroundColor Yellow
Write-Host '  ============================================' -ForegroundColor DarkYellow
Write-Host ''

# 端口占用检查
$busy = $null
try { $busy = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop } catch { }
if ($busy) {
    Write-Host "  端口 $Port 已被占用，尝试换用 $($Port + 1) …" -ForegroundColor DarkGray
    $Port = $Port + 1
}

$server = Join-Path $root 'tools\serve.cjs'
$url = "http://127.0.0.1:$Port/"

Write-Host "  游戏地址: $url" -ForegroundColor Cyan
Write-Host '  浏览器已自动打开；关闭本窗口即停止服务器。' -ForegroundColor DarkGray
Write-Host ''

$job = Start-Job -ScriptBlock {
    param($s, $p)
    node $s $p
} -ArgumentList $server, $Port

Start-Sleep -Milliseconds 900
Start-Process $url

try {
    while ($true) {
        Receive-Job $job | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
        if ($job.State -ne 'Running') { break }
        Start-Sleep -Milliseconds 400
    }
} finally {
    Stop-Job $job -ErrorAction SilentlyContinue
    Remove-Job $job -Force -ErrorAction SilentlyContinue
    Write-Host ''
    Write-Host '  服务器已停止。' -ForegroundColor DarkGray
}
