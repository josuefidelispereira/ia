@echo off
REM Este script automatiza o envio de atualizacoes para o GitHub.

REM Define o título da janela do console
title Enviando para o GitHub

REM Limpa a tela
cls

echo ======================================================
echo  ATUALIZANDO REPOSITORIO GIT E ENVIANDO PARA O GITHUB
echo ======================================================
echo.

REM Pede ao usuario para inserir uma mensagem de commit
set /p commitMessage="Digite a mensagem do commit e pressione Enter: "

echo.
echo Preparando arquivos (git add .)...
git add .

echo.
echo Criando commit com a mensagem: "%commitMessage%"
git commit -m "%commitMessage%"

echo.
echo Enviando para o GitHub (git push)...
git push

echo.
echo ======================================================
echo  PROCESSO CONCLUIDO!
echo ======================================================
echo.

REM Pausa o script para que o usuario possa ver o resultado
pause