@echo off
chcp 65001 >nul
title FlowMind Backend — 环境初始化
setlocal enabledelayedexpansion

set "PROJECT_ROOT=%~dp0"
set "VENV_DIR=%PROJECT_ROOT%.venv"
set "LOG_FILE=%PROJECT_ROOT%setup.log"

echo [%TIME:~0,8%] === FlowMind 环境初始化 ===
echo [%TIME:~0,8%] 项目目录: %PROJECT_ROOT%

:: 检查 Python
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python 未安装，请先安装 Python 3.11+
    pause
    exit /b 1
)

python -c "import sys; exit(0 if sys.version_info >= (3,11) else 1)" >nul 2>nul
if %ERRORLEVEL% neq 0 (
    for /f %%i in ('python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"') do set "PYVER=%%i"
    echo [ERROR] 需要 Python 3.11+，当前为 %PYVER%
    pause
    exit /b 1
)

echo [%TIME:~0,8%] Python: 
python --version

:: 创建虚拟环境
if exist "%VENV_DIR%" (
    echo [%TIME:~0,8%] 虚拟环境已存在: %VENV_DIR%
) else (
    echo [%TIME:~0,8%] 创建虚拟环境...
    python -m venv "%VENV_DIR%"
    echo [%TIME:~0,8%] 虚拟环境创建完成
)

:: 安装依赖
set "PIP=%VENV_DIR%\Scripts\pip.exe"
echo [%TIME:~0,8%] 安装依赖...
"%PIP%" install -r "%PROJECT_ROOT%requirements.txt" -q --no-cache-dir

:: 验证
echo [%TIME:~0,8%] 验证安装...
set "PYTHON=%VENV_DIR%\Scripts\python.exe"
"%PYTHON%" -c "import sys; sys.path.insert(0, '%PROJECT_ROOT%'); sys.path.insert(0, '%PROJECT_ROOT%backend'); from aider_worker import Contract, AiderWorker; print('✅ AiderWorker 就绪')"

echo.
echo ================================
echo  FlowMind 环境初始化完成
echo ================================
echo.
echo 启动服务:
echo   %VENV_DIR%\Scripts\Activate
echo   python -m aider_worker.worker_main --port 50051
echo.
pause
