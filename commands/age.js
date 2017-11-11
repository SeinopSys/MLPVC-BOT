const
	moment = require('moment'),
	Command = require('../classes/Command'),
	Server = require('../classes/Server'),
	Time = require('../classes/Time'),
	util = require('../shared-utils');

module.exports = new Command({
	name: 'age',
	help: 'Return the age of the server',
	perm: 'everyone',
	usage: [true],
	action: args => {
		if (args.isPM)
			return Server.respond(args.channelID, util.onserver);

		const
			date = new Date((Server.our.id / 4194304) + 1420070400000),
			age = moment(date),
			delta = Time.Remaining(new Date(), date);
		Server.respond(args.channelID, util.replyTo(args.userID,'The server was created on '+(age.format('Do MMMM, YYYY'))+' ('+delta+')'));
	},
});
