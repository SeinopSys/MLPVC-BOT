const
	Command = require('../classes/Command'),
	Server = require('../classes/Server'),
	util = require('../shared-utils');

module.exports = new Command({
	name: 'version',
	help: 'Returns the bot\'s version number & when that version was created',
	perm: 'everyone',
	usage: [true],
	action: args => {
		Server.bot.simulateTyping(args.channelID);
		Server.getVersion(args.channelID, args.userID, (ver, timeago) => {
			Server.respond(args.channelID, util.replyTo(args.userID, `Bot is running version \`${ver}\` created ${timeago}\nView commit on GitHub: http://github.com/ponydevs/MLPVC-BOT/commit/`+ver));
		});
	},
});
