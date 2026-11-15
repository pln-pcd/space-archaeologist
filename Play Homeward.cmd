@echo off
where pythonw >nul 2>nul
if errorlevel 1 (
    python "%~dp0tools\launch_game.py"
) else (
    start "" pythonw "%~dp0tools\launch_game.py"
)
