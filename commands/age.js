const
	moment = require('moment-timezone'),
	Command = require('../classes/Command'),
	Server = require('../classes/Server'),
	Time = require('../classes/Time');

module.exports = new Command({
	name: 'age',
	help: 'Return the age of the server',
	perm: 'everyone',
	usage: [true],
	allowPM: false,
	action: args => {
		const
			date = Server.our.createdAt,
			age = moment(date).tz('UTC'),
			delta = Time.Remaining(new Date(), date);
		Server.reply(args.message, `The ${Server.our.name} Discord server was created on ${age.format('Do MMMM, YYYY')} at ${age.format('HH:mm:ss z')} (${delta})`);
	},
});
