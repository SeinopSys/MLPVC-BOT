const
	Command = require('../classes/Command'),
	Server = require('../classes/Server'),
	util = require('../shared-utils');

module.exports = new Command({
	name: 'roleids',
	help: 'Returns a list of role IDs on the server',
	perm: 'isOwner',
	usage: [true],
	action: args => {
		if (!Server.commandPermCheck(args.command, args.userID))
			Server.respond(args.channelID, util.replyTo(args.userID, 'You must be owner to use this command'));

		let message = [],
			keys = Object.keys(Server.roleids);
		keys.forEach(function(key){
			message.push(Server.roleids[key]+' ('+key+')');
		});
		Server.respond(args.channelID, util.replyTo(args.userID, `List of available roles for server ${Server.our.name}:\n\`\`\`\n${message.join('\n')}\n\`\`\``));
	}
});
