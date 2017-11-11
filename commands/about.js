const
	Command = require('../classes/Command'),
	util = require('../shared-utils'),
	Server = require('../classes/Server');

module.exports = new Command({
	name: 'about',
	help: 'Retrieves information about a user',
	perm: 'isOwner',
	usage: ['me', 'MLPVC-RR'],
	action: args => {
		if (!Server.commandPermCheck(args.command, args.userID))
			return Server.respond(args.channelID, util.replyToIfNotPM(args.isPM, args.userID, 'You must be owner to use this command'));

		let data = Server.getUserData(args.argArr[0], args);

		Server.respond(args.channelID, util.replyToIfNotPM(args.isPM, args.userID, 'User details:\n```json\n' + JSON.stringify(data, null, '\t') + '\n```'));
	},
});
