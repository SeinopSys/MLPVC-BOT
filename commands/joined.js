const
	moment = require('moment-timezone'),
	Command = require('../classes/Command'),
	Server = require('../classes/Server'),
	Time = require('../classes/Time');

module.exports = new Command({
	name: 'joined',
	help: 'Displays when the specified user joined the server',
	perm: 'isStaff',
	usage: ['@Mention#1234'],
	allowPM: true,
	action: async args => {
		if (typeof args.argArr[0] !== 'string')
			return Server.reply(args.message, 'The first parameter is mandatory');

		const target = args.argArr[0];
		let targetUserData = await Server.getUserData(target, args);
		if (targetUserData === false)
			return;
		if (typeof targetUserData !== 'object')
			return Server.reply(args.message, 'Could not find the specified user');

		const member = await Server.findMember(targetUserData.id);
		const
			date = member.joinedAt,
			age = moment(date).tz('UTC'),
			delta = Time.Remaining(new Date(), date);
		Server.reply(args.message, `${member.displayName||member.user.name} joined the server on ${age.format('Do MMMM, YYYY')} at ${age.format('HH:mm:ss z')} (${delta})`);
	},
});
