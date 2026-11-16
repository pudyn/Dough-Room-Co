@echo off
REM Build print agent untuk Windows (jalankan di mesin Windows dengan Go terpasang)
cd /d %~dp0
set GOOS=windows
set GOARCH=amd64
go build -o printer-agent.exe .
echo Selesai: printer-agent.exe
