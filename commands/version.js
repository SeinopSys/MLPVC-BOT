const
	Command = require('../classes/Command'),
	Server = require('../classes/Server');

module.exports = new Command({
	name: 'version',
	help: "Returns the bot's version number & when that version was created",
	perm: 'everyone',
	usage: [true],
	allowPM: true,
	action: args => {
		Server.getGitData().then(data => {
			Server.reply(args.message, `Bot is running version \`${data.hash}\` created ${data.timeago}\nView commit on GitHub: <https://github.com/MLP-VectorClub/PennyCurve/commit/${data.hash}>`);
		}).catch(e => {
			Server.reply(args.message, e);
		});
	},
});
