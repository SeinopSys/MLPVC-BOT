#! /bin/bash
git reset HEAD --hard
git pull
forever list | grep discord-bot.js && forever stop discord-bot.js
forever start -c "node --max-old-space-size=128" discord-bot.js
forever list
