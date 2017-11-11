const
	Command = require('../classes/Command'),
	util = require('../shared-utils'),
	Server = require('../classes/Server');

module.exports = new Command({
	name: 'fixnick',
	help: 'Changes your nickname to the format specified in the first argument (if you have one).\n\t- `brackets`: DiscordName (DAName)\n\t- `pipe`: DAName | DiscordName\n\t- `da`: DAName\nStaff can use a user\'s name as the last argument to change specific user\'s nick. Does not work on Staff members due to API limitations.',
	perm: 'everyone',
	usage: ['brackets', 'pipe me', 'da @Mention#1234'],
	action: args => {
		if (typeof args.argArr[0] !== 'string')
			return Server.respond(args.channelID, util.replyToIfNotPM(args.isPM, args.userID, 'The first (format) parameter is mandatory'));
		let format;
		switch (args.argArr[0]){
			case "pipe": format = 'da | disc'; break;
			case "brackets":
			case "bracket": format = 'disc (da)'; break;
			case "da": format = 'da'; break;
		}
		let data = Server.getUserData(Server.perm.isStaff.check(args.userID) ? (args.argArr[1]||'me') : 'me', args);
		if (typeof data !== 'object')
			return Server.respond(args.channelID, util.replyToIfNotPM(args.isPM, args.userID, 'Could not find the specified user'));
		if (typeof data.nick !== 'string')
			return Server.respond(args.channelID, util.replyToIfNotPM(args.isPM, args.userID, 'You do not have a nickname on our server.'));

		let originalNick = data.nick.replace(/^(?:.*\(([a-zA-Z\d-]{1,20})\)|([a-zA-Z\d-]{1,20})\s\|.*)$/,'$1$2'),
			nick = format.replace('da',originalNick).replace('disc',data.username);
		Server.bot.editNickname({
			serverID: Server.our.id,
			userID: data.id,
			nick: nick,
		},function(err){
			if (err){
				if (err.response && err.response.message === 'Privilege is too low...')
					return Server.respond(args.channelID, util.replyToIfNotPM(args.isPM, args.userID, 'Changing nick failed: Due to Discord API limitations the bot can only set the nicks of users whose roles are under the bot\'s in the hierarchy.'));
				const nickmatch = /^Must be (\d+)/;
				if (err.response && nickmatch.test(err.response.nick[0]))
					return Server.respond(args.channelID, util.replyToIfNotPM(args.isPM, args.userID, `The resulting nickname (\`${nick}\`) exceeds Discord's ${err.response.nick[0].match(nickmatch)[1]} character limit.`));
				console.log(err);
				return Server.respond(args.channelID, util.replyToIfNotPM(args.isPM, args.userID, 'Changing nick failed.'+(err.response && err.response.message ? ' ('+err.response.message+')' : '')+'\n'+Server.mentionOwner(args.userID) + ' should see what caused the issue in the logs.'));
			}

			return Server.respond(args.channelID, util.replyToIfNotPM(args.isPM, args.userID, (args.userID === data.id ? 'Your nickname' : 'The nickname of <@'+data.id+'>')+' has been updated to `'+nick+'`'));
		});
	},
});
