const
	Command = require('../classes/Command'),
	config = require('../config'),
	util = require('../shared-utils'),
	Server = require('../classes/Server');

const nsfwRoleName = 'Pony Sauce';

module.exports = new Command({
	name: 'nsfw',
	help:
	'When ran without any arguments: sends a message to the current conversation warning participants to avoid discussing NSFW content in the current channel, and informs them about the existence of the NSFW channel\'s existance and how they can join it.\n' +
	'There\'s an __optional__ argument which can be one of the following:\n' +
	'\t● `join` - Allows the user running this command to join the NSFW channel at will\n' +
	'\t● `leave` - Allows the user running this command to leave the NSFW channel at will',
	usage: [true, 'join', 'leave'],
	perm: 'everyone',
	allowPM: true,
	action: async args => {
		if (!args.isPM)
			Server.wipeMessage(args.message);
		if (args.channel.name !== 'nsfw' && args.argArr.length === 0){
			const responseText = (
				args.channel.name === 'nsfw'
				? null
				: (
				(await Server.perm.isStaff.check(args.authorID))
						? 'Please avoid discussing anything NSFW ' + (
						!args.isPM
							? 'in ' + Server.mention(args.channel)
							: 'outside ' + Server.mention(Server.findChannel('nsfw'))
					) + '.'
						: ''
				)
			) + ' We have a dedicated invite-only NSFW channel, send `/nsfw join` if you\'d like to gain access.\n' + config.SITE_ABSPATH + 'img/discord/nsfw.gif';
			if (!args.isPM)
				Server.wipeMessage(args.message);
			return Server.reply(args.message, responseText);
		}

		const action = args.argArr[0].toLowerCase();
		switch (action){
			case "join":
			case "leave":
				const
					member = await Server.findMember(args.author.id),
					nsfwChannel = Server.findChannel('nsfw');

				if (member.roles.get(Server.staffroleid))
					Server.send(args.author, `**Note:** Because you have the Staff role you will see ${Server.mention(nsfwChannel)} no matter what.${action === 'leave' ? ` If you don't wand to see or be notified of new messages, right-click the channel and click \`Mute #nsfw\`` : ''}`);

				if (action === 'join'){
					if (member.roles.exists('name', nsfwRoleName))
						return Server.send(args.author, `You can already see ${Server.mention(nsfwChannel)}. To leave, send \`/nsfw leave\` in any channel.`);

					Server.addRole(args.author, nsfwRoleName, '/nsfw join command').then(() => {
						Server.send(nsfwChannel, util.replyTo(args.author, 'Welcome aboard. If at any point you wish to leave the channel, use `/nsfw leave`'));
					}).catch(err => {
						console.error(err);
						Server.send(args.channel, Server.addErrorMessageToResponse(err, `Failed to join ${Server.mention(nsfwChannel)} channel`));
					});
				}
				else {
					if (!member.roles.exists('name', nsfwRoleName))
						return Server.send(args.author, `You haven't revealed the NSFW channel yet. To join, send \`/nsfw join\` in any channel.`);

					Server.removeRole(args.author, nsfwRoleName, '/nsfw leave command').then(() => {
						Server.send(nsfwChannel, util.replyTo(args.author, 'left the channel'));
					}).catch(err => {
						console.error(err);
						Server.send(args.channel, Server.addErrorMessageToResponse(err, `Failed to leave ${Server.mention(nsfwChannel)} channel`));
					});
				}
				break;
			default:
				Server.reply(args.message, `Unknown action ${action}`);
		}
	},
});
