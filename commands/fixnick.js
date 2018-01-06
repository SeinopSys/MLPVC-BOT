const
	Command = require('../classes/Command'),
	Server = require('../classes/Server');

module.exports = new Command({
	name: 'fixnick',
	help: 'Changes your nickname to the format specified in the first argument (if you have one).\n\t- `brackets`: DiscordName (DAName)\n\t- `pipe`: DAName | DiscordName\n\t- `da`/`reset`/`nick`: DAName\nStaff can use a user\'s name as the last argument to change specific user\'s nick. Does not work on Staff members due to API limitations.',
	perm: 'everyone',
	usage: ['brackets', 'pipe me', 'da @Mention#1234'],
	allowPM: true,
	action: args => {
		if (typeof args.argArr[0] !== 'string')
			return Server.reply(args.message, 'The first (format) parameter is mandatory');
		let format;
		switch (args.argArr[0]){
			case "pipe": format = 'da | disc'; break;
			case "brackets":
			case "bracket": format = 'disc (da)'; break;
			case "reset":
			case "nick":
			case "da": format = 'da'; break;
			default:
				return Server.reply(args.message, `Unknown format: \`${args.argArr[0]}\``);
		}

		let targetUserData = Server.getUserData(Server.perm.isStaff.check(args.authorID) ? (args.argArr[1]||'me') : 'me', args);
		if (targetUserData === false)
			return;
		if (typeof targetUserData !== 'object')
			return Server.reply(args.message, 'Could not find the specified user');
		if (targetUserData.bot)
			return Server.reply(args.message, 'This command cannot be used on bot accounts.');
		if (typeof targetUserData.nick !== 'string')
			return Server.reply(args.message, 'You do not have a nickname on our server.');

		let originalNick = targetUserData.nick.replace(/^(?:.*\(([a-zA-Z\d-]{1,20})\)|([a-zA-Z\d-]{1,20})\s\|.*)$/,'$1$2'),
			nick = format.replace('da',originalNick).replace('disc',targetUserData.username);
		targetUserData.member.setNickname(nick).then(() => {
			Server.reply(args.message, `${args.authorID === targetUserData.id ? 'Your nickname' : `The nickname of ${Server.mentionUser(targetUserData.id)}`} has been updated to \`${nick}\``);
		}).catch(e => {
			if (e.message === 'Privilege is too low...')
				return Server.reply(args.message, 'Changing nick failed: Due to Discord API limitations the bot can only set the nicks of users whose roles are under the bot\'s in the hierarchy.');
			const nickmatch = /Must be (\d+)/;
			console.error(e);
			if (nickmatch.test(e.message))
				return Server.reply(args.message, `The resulting nickname (\`${nick}\`) exceeds Discord's ${e.message.match(nickmatch)[1]} character limit.`);
			return Server.reply(args.message, `Changing nick failed.\`\`\`${e.message})\`\`\``);
		});
	},
});
