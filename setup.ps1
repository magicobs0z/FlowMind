<#
.SYNOPSIS
  FlowMind Backend — 一键环境初始化脚本
  自动创建虚拟环境并安装所有依赖
.DESCRIPTION
  用法: 右键 → "Run with PowerShell" 或:
  powershell -ExecutionPolicy Bypass -File setup.ps1
#>

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvDir = Join-Path $ProjectRoot ".venv"
$LogFile = Join-Path $ProjectRoot "setup.log"

function Log { param([string]$Msg) $ts = Get-Date -Format "HH:mm:ss"; "$ts $Msg" | Tee-Object -FilePath $LogFile -Append }

# ── 0. 检查 Python ──
Log "=== FlowMind 环境初始化 ==="
Log "项目目录: $ProjectRoot"

$py = Get-Command "python" -ErrorAction SilentlyContinue
if (-not $py) {
    Log "[ERROR] Python 未安装，请先安装 Python 3.11+"
    exit 1
}
$ver = & python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
Log "检测到 Python $ver : $( & python -c "import sys; print(sys.executable)" )"

if ([version]$ver -lt [version]"3.11") {
    Log "[ERROR] 需要 Python 3.11+，当前为 $ver"
    exit 1
}

# ── 1. 创建虚拟环境 ──
if (Test-Path $VenvDir) {
    Log "虚拟环境已存在: $VenvDir"
} else {
    Log "创建虚拟环境..."
    & python -m venv $VenvDir
    Log "虚拟环境创建完成"
}

# 确定 pip 路径
$pip = Join-Path $VenvDir "Scripts\pip.exe"
if (-not (Test-Path $pip)) {
    Log "[ERROR] pip 未找到: $pip"
    exit 1
}

# ── 2. 升级 pip ──
Log "升级 pip..."
& $pip install --upgrade pip -q
Log "pip 升级完成"

# ── 3. 安装依赖 ──
$req = Join-Path $ProjectRoot "requirements.txt"
if (Test-Path $req) {
    Log "安装依赖 (从 requirements.txt)..."
    & $pip install -r $req -q --no-cache-dir
    if ($LASTEXITCODE -ne 0) {
        Log "[WARN] 部分依赖安装可能失败，尝试逐个安装..."
        # 逐个安装，忽略失败
        Get-Content $req | Where-Object { $_ -match "^[a-zA-Z]" } | ForEach-Object {
            $pkg = $_ -replace ">=.*", "" -replace "==.*", "" -trim
            & $pip install $pkg -q 2>$null
        }
    }
    Log "依赖安装完成"
} else {
    Log "[WARN] requirements.txt 未找到，跳过依赖安装"
}

# ── 4. 验证 ──
Log ""
Log "=== 验证安装 ==="
$python = Join-Path $VenvDir "Scripts\python.exe"

# 验证 aider_worker 导入
$testCode = @"
import sys, os
# 添加项目路径（aider 已整合到 FlowMind/ 内）
sys.path.insert(0, r'$ProjectRoot')
sys.path.insert(0, r'$ProjectRoot\backend')
from aider_worker import Contract, AiderWorker
from aider_worker.gen import worker_pb2
print('AiderWorker 全栈就绪')
"@

$result = & $python -c $testCode 2>&1
if ($LASTEXITCODE -eq 0) {
    Log "✅ $result"
} else {
    Log "❌ 验证失败: $result"
}

Log ""
Log "=== 环境初始化完成 ==="
Log ""
Log "启动方式:"
Log "  1. 运行 .env.bat (CMD)"
Log "  2. 或运行以下命令激活:"
Log "     $VenvDir\Scripts\Activate.ps1"
Log ""
Log "启动服务:"
Log "     python -m aider_worker.worker_main --port 50051"
