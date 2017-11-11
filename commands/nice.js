const
	Command = require('../classes/Command'),
	Server = require('../classes/Server'),
	util = require('../shared-utils');

module.exports = new Command({
	name: 'nice',
	help: 'Nice',
	perm: 'everyone',
	usage: [true],
	action: args => {
		Server.respond(args.channelID, util.replyTo(args.userID,'https://youtube.com/watch?v=ffQmb-cNFuk'));
	}
});
