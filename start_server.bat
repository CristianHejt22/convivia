@echo off
title CONVIVIA Web Server
echo ========================================================
echo       CONVIVIA - COMUNIDAD CONVIVIAL
echo ========================================================
echo Iniciando servidor PHP en http://localhost:8000 ...
echo Presione Ctrl + C para detener el servidor.
echo.
"C:\xampp\php\php.exe" -S localhost:8000 -t "d:\ptshop" "d:\ptshop\router.php"
pause
