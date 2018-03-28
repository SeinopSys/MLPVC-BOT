#!/usr/bin/env bash
echo "##### post-receive hook #####"
read oldrev newrev refname
echo "Push triggered update to revision $newrev ($refname)"

CMD_CD="cd $(readlink -nf "$PWD/..")"
CMD_FETCH="env -i git fetch"
CMD_YARN="sudo -u www-data yarn install --production"
CMD_FOREVER_STOP="forever list | grep discord-bot.js && forever stop discord-bot.js"
CMD_FOREVER_START="forever start -c 'node --max-old-space-size=128' discord-bot.js"
CMD_FOREVER_LIST="forever list"

echo "$ $CMD_CD"
eval ${CMD_CD}
echo "$ $CMD_FETCH"
eval ${CMD_FETCH}
echo "$ $CMD_YARN"
eval ${CMD_YARN}
echo "$ $CMD_FOREVER_STOP"
eval ${CMD_FOREVER_STOP}
echo "$ $CMD_FOREVER_START"
eval ${CMD_FOREVER_START}
echo "$ $CMD_FOREVER_LIST"
eval ${CMD_FOREVER_LIST}

echo "##### end post-receive hook #####"
