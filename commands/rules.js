const
	Command = require('../classes/Command'),
	Server = require('../classes/Server');

module.exports = new Command({
	name: 'rules',
	help: 'List the server rules',
	perm: 'everyone',
	usage: [true],
	action: args => {
		if (!args.isPM)
			Server.wipeMessage(args.channelID, args.event.d.id);
		Server.respond(args.userID, '__**Server rules:**__\n\n'+Server.getRules());
	},
});
