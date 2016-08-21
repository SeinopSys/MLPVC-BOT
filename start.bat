@echo off
call forever stop discord-bot.js
forever start discord-bot.js
forever list
