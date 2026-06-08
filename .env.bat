@echo off
REM ========================================
REM FlowMind 后端 — 环境激活脚本
REM 自动使用项目内的虚拟环境
REM ========================================

set "VENV_DIR=%~dp0.venv"

REM PYTHONPATH：指向后端代码 + Aider 源码（已整合到 FlowMind/ 内）
set "PYTHONPATH=%~dp0;%~dp0backend"

REM 临时目录重定向到项目内（不写 C 盘）
set "TMP=%~dp0.tmp"
set "TEMP=%~dp0.tmp"
if not exist "%~dp0.tmp" mkdir "%~dp0.tmp" >nul 2>nul

REM 激活虚拟环境
if exist "%VENV_DIR%\Scripts\activate.bat" (
    call "%VENV_DIR%\Scripts\activate.bat"
) else (
    echo [WARN] 虚拟环境不存在，请先运行 setup.bat
)

echo.
echo [OK] FlowMind Backend 环境已就绪
echo      Python: %VIRTUAL_ENV%\Scripts\python.exe
echo      PYTHONPATH: %PYTHONPATH%
echo      服务: python -m aider_worker.worker_main --port 50051
echo.
