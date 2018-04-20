#!/usr/bin/env bash
read oldrev newrev refname
echo "Push triggered update to revision $newrev ($refname)"

GIT="env -i git"
CMD_PWD="cd .. && pwd"
CMD_FETCH="$GIT fetch"
CMD_YARN="yarn install --production"
CMD_RESTART="pm2 restart pm2.json"

echo "$ $CMD_PWD"
eval $CMD_PWD
echo "$ $CMD_FETCH"
eval $CMD_FETCH

if $GIT diff --name-only $oldrev $newrev | grep "^yarn.lock"; then
	echo "$ $CMD_YARN"
	eval $CMD_YARN
else
	echo "# Skipping Yarn install, lockfile not modified"
fi

echo "$ $CMD_RESTART"
eval $CMD_RESTART
