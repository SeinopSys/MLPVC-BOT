const
	fs = require('fs'),
	chalk = require('chalk'),
	unirest = require('unirest'),
	Command = require('../classes/Command'),
	util = require('../shared-utils'),
	Server = require('../classes/Server');

module.exports = new Command({
	name: 'avatar',
	help: 'This command can be used to change the bot\'s avatar by passing an image URL, or set it back to the default by passing `reset`.',
	perm: 'isStaff',
	usage: ['http://placehold.it/300x300/000000/ffffff.png?text=MLPVC-BOT', 'reset'],
	action: args => {
		if (!Server.commandPermCheck(args.command, args.userID))
			return Server.respond(args.channelID, util.replyToIfNotPM(args.isPM,args. userID, 'You do not have permission to use this command.'));

		let url = args.argStr.trim(),
			reset = url === 'reset',
			actioned = reset?'reset':'updated',
			setAvatar = function(avatarBase64){
				Server.bot.editUserInfo({
					avatar: avatarBase64,
				}, function(err){
					if (err){
						console.log(err);
						return Server.respond(args.channelID, util.replyToIfNotPM(args.isPM, args.userID, 'Setting avatar failed. ' + Server.mentionOwner(args.userID) + ' should see what caused the issue in the logs.'));
					}

					let outputChannel = Server.channelids.staffchat,
						staffChatExists = typeof Server.channelids.staffchat === 'string';
					if (!staffChatExists){
						if (args.isPM)
							console.log(chalk.blue('#staffchat')+' channel does not exist, could not send avatar update message');
						else outputChannel = args.channelID;
					}

					if (!args.isPM)
						Server.wipeMessage(args.channelID, args.event.d.id);
					else Server.respond(args.channelID, 'The bot\'s avatar has been '+actioned+(staffChatExists?', and a notice was sent to the other staff members':'')+'.');
					Server.respond(outputChannel, 'The bot\'s avatar has been '+actioned+' by <@' + args.userID + '>' + (args.isPM ? ' (via PM)':'')+(!reset?' to the following image: ' + url:''));
				});
			};
		if (reset)
			return setAvatar(fs.readFileSync('assets/default_avatar.png', 'base64'));
		if (!/^https?:\/\/.*$/.test(url))
			return Server.respond(args.channelID, util.replyToIfNotPM(args.isPM, args.userID, 'The parameter must be a valid URL'));

		unirest.get(url)
			.encoding(null)
			.end(function(result){
				if ((result.error || !(result.body instanceof Buffer))){
					console.log(result.error, result.body);
					return Server.respond(args.channelID, util.replyTo(args.userID, 'Could not download image (HTTP ' + result.status + '). ' + Server.mentionOwner(args.userID) + ' should see what caused the issue in the logs.'));
				}

				let avatarBase64 = new Buffer(result.body).toString('base64');

				setAvatar(avatarBase64, reset);
			});
	},
});
