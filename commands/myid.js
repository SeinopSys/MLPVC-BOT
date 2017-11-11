const
	Command = require('../classes/Command'),
	Server = require('../classes/Server'),
	util = require('../shared-utils');

let myIDran = false;

module.exports = new Command({
	name: 'myid',
	help: 'Returns your user ID (used for initial script setup)',
	perm: 'isOwner',
	usage: [true],
	action: args =>{
		if (!Server.hasOwner){
			if (myIDran)
				return Server.respond(args.channelID, util.replyToIfNotPM(args.isPM, args.userID, 'This command can only be executed once per server start-up until the owner\'s ID is set'));
			else myIDran = true;
		}
		else if (!Server.commandPermCheck(args.command, args.userID))
			return Server.respond(args.channelID, util.replyToIfNotPM(args.isPM, args.userID, 'You must be owner to use this command'));

		Server.respond(args.channelID, util.replyTo(args.userID, 'Your user ID was sent to you in a private message'));
		Server.respond(args.userID, 'Your user ID is `' + args.userID + '`');
	}
});
