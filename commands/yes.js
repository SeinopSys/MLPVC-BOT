const
	Command = require('../classes/Command'),
	Server = require('../classes/Server'),
	util = require('../shared-utils');

module.exports = new Command({
	name: 'yes',
	help: 'Yes',
	perm: 'everyone',
	usage: [true],
	action: args => {
		Server.respond(args.channelID, util.replyTo(args.userID,'https://www.youtube.com/watch?v=P3ALwKeSEYs'));
	}
});
