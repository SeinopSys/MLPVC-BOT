const
	Command = require('../classes/Command'),
	Server = require('../classes/Server'),
	util = require('../shared-utils');

module.exports = new Command({
	name: 'channels',
	help: 'Returns available channels on our server (used for initial script setup)',
	perm: 'isOwner',
	usage: [true],
	action: args => {
		if (!Server.commandPermCheck(args.command, args.userID))
			return util.respond(args.channelID, util.replyTo(args.userID, 'You must be owner to use this command'));

		let ids = [];
		for (let i in Server.our.channels){
			if (Server.our.channels.hasOwnProperty(i)){
				let channel = Server.our.channels[i];
				ids.push('├ '+(channel.type==='text'?'#':'\uD83D\uDD0A')+channel.name+' ('+channel.id+')');
			}
		}
		ids.push(ids.pop().replace('├','└'));
		Server.respond(args.channelID, util.replyTo(args.userID, "```"+Server.our.name+" ("+Server.our.id+")\n"+ids.join('\n')+'```'));
	}
});
