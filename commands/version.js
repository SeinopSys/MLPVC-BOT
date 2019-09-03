const
	Command = require('../classes/Command'),
	Server = require('../classes/Server'),
	util = require('../shared-utils');

module.exports = new Command({
	name: 'version',
	help: "Returns the bot's version number & when that version was created",
	perm: 'everyone',
	usage: [true],
	allowPM: true,
	action: args => {
		const { commitId, commitAgo } = util;
		try {
		  Server.reply(args.message, `Bot is running version \`${commitId}\` created ${commitAgo}\nView commit on GitHub: <https://github.com/MLP-VectorClub/PennyCurve/commit/${commitId}>`);
		} catch(e) {
			Server.reply(args.message, e);
		}
	},
});
