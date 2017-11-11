const
	Command = require('../classes/Command'),
	Server = require('../classes/Server'),
	util = require('../shared-utils');

module.exports = new Command({
	name: 'edit',
	help: 'Allows editing messages posted by the bot in the current channel. The first parameter is a message ID, which you can get by turning on Developer mode in Discord settings, then right-clikcing a message and selecting "Copy ID", and the second parameter is a replacement command, where the first character is a separator, followed by a pattern, the sepearator, the replacement string and the separator again, optionally followed by flags.\nFlags are identical to the ones shown here: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp#Parameters>\nThe only exception is the `g`flag, which is enabled by default even if it\'s not specified. Passing an uppercase `G` in the flags will disable the automatic `g` flag.',
	perm: 'isStaff',
	usage: ['98713564826483 |this|that|','92384962349237 |first occurrence|1st occurrence|G'],
	action: args => {
		if (args.isPM)
			return Server.respond(args.channelID, util.onserver);

		// Don't post responses in the #welcome channel
		const inWelcome = args.channelID === Server.channelids.welcome;
		const notify = inWelcome ? args.userID : args.channelID;

		if (args.argArr.length < 2)
			return Server.respond(notify, util.reqparams(args.command));

		const messageID = args.argArr[0];
		if (/\D/.test(messageID))
			return Server.respond(notify, 'Message ID can only contain buttons');

		const
			repl = args.argStr.replace(messageID,'').trim(),
			separator = repl[0];
		if (!/^(\S).*[^\\]\1.*\1([imuyG]+)?$/.test(repl))
			return Server.respond(notify, 'Replacement command is invalid');

		let [pattern, replacement, flags] = repl.split(separator).slice(1,4);
		// Force global flag, disable with G
		if (flags.indexOf('G') === -1)
			flags = (flags || '')+'g';
		else flags = flags.replace('G','');

		Server.bot.getMessage({
			channelID: args.channelID,
			messageID,
		}, (err, message) => {
			if (err){
				console.log(err);
				return Server.respond(notify, util.replyTo(args.userID, 'Failed to get message text from Discord. '+(Server.hasOwner ? Server.mentionOwner(args.userID)+' should see what caused this in the logs.' : '')));
			}

			const newContent = message.content.replace(new RegExp(pattern,flags), replacement);

			if (newContent === message.content)
				return Server.respond(notify, util.replyTo(args.userID, 'Your replacement made no changes to the message'));

			Server.bot.editMessage({
				channelID: message.channel_id,
				messageID: message.id,
				message: newContent,
			}, err => {
				if (err){
					if (err.statusCode === 403)
						return Server.respond(notify, util.replyTo(args.userID, 'Message could not be edited. Reason: '+err.response.message));
					console.log(err);
					return Server.respond(notify, util.replyTo(args.userID, 'Message could not be edited. '+(Server.hasOwner ? Server.mentionOwner(args.userID)+' should see what caused this in the logs.' : '')));
				}

				Server.respond(notify, util.replyTo(args.userID, `Message${inWelcome?` ${message.id} in <#${message.channel_id}>`:''} updated`));
			});
		});
	},
});
