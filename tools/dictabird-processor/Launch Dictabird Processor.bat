@echo off
setlocal
cd /d "%~dp0"

if exist ".venv\Scripts\python.exe" (
  set "PY=.venv\Scripts\python.exe"
) else (
  set "PY=python"
)

"%PY%" -c "import faster_whisper" 2>nul
if errorlevel 1 (
  echo Installing dependencies into .venv ...
  if not exist ".venv\Scripts\python.exe" (
    python -m venv .venv
    set "PY=.venv\Scripts\python.exe"
  )
  "%PY%" -m pip install -r requirements.txt
  if errorlevel 1 (
    echo Failed to install requirements.
    pause
    exit /b 1
  )
)

start "Dictabird Processor" "%PY%" gui.py
endlocal
