const
	Command = require('../classes/Command'),
	config = require('../config'),
	util = require('../shared-utils'),
	Server = require('../classes/Server');

module.exports = new Command({
	name: 'nsfw',
	help:
	'When ran without any arguments: sends a message to the current conversation warning participants to avoid discussing NSFW content in the current channel, and informs them about the existence of the <#nsfw> channel\'s existance and how they can join it.\n' +
	'There\'s an __optional__ argument which can be one of the following:\n' +
	'\t● `join` - Allows the user running this command to join the <#nsfw> channel at will\n' +
	'\t● `leave` - Allows the user running this command to leave the <#nsfw> channel at will',
	usage: [true, 'join', 'leave'],
	perm: 'everyone',
	action: args => {
		if (args.channelID in Server.our.channels && Server.our.channels[args.channelID].name === 'nsfw' && args.argArr[0] !== 'leave')
			return;
		if (!args.argArr.length){
			let message = (
				args.channelID === Server.channelids.nsfw
				? null
				: (
					Server.perm.isStaff.check(args.userID)
					? 'Please avoid discussing anything NSFW '+(
						!args.isPM
						? 'in <#'+args.channelID+'>'
						:'outside <#'+Server.channelids.nsfw+'>'
					)+'.'
					:''
				)
			)+' We have a dedicated invite-only NSFW channel, send `/nsfw join` to join.\n'+config.SITE_ABSPATH+'img/discord/nsfw.gif';
			return args.isPM ? Server.respond(args.channelID, message) : Server.wipeMessage(args.channelID, args.event.d.id, message);
		}

		switch (args.argArr[0]){
			case "join":
				Server.wipeMessage(args.channelID, args.event.d.id,function(msg, error){
					if (Server.our.members[args.userID].roles.indexOf(Server.staffroleid) !== -1)
						return Server.respond(args.userID, 'Because you have the Staff role you will see the <#'+Server.channelids.nsfw+'> channel no matter what.\nIf you don\'t wand to be notified of new messages, right-click the channel and click `Mute #nsfw`');
					else if (Server.our.members[args.userID].roles.indexOf(Server.roleids['Pony Sauce']) !== -1)
						return Server.respond(args.userID, 'You are already a member of the #nsfw channel. To leave, send `/nsfw leave` in any channel.\n(**Notice:** Messages sent in PMs are ignored!)');
					if (error){
						console.log('Error while adding Pony Sauce role to ' + args.userIdent);
						console.log(error);
					}

					Server.addRole(args.userID, 'Pony Sauce').catch(err => {
						Server.respond(args.channelID, Server.addErrorMessageToResponse(err, 'Failed to join <#'+Server.channelids.nsfw+'> channel'));
					}).then(() => {
						Server.respond(Server.channelids.nsfw, util.replyTo(args.userID, 'Welcome aboard. If at any point you wish to leave the channel, use `/nsfw leave`'));
					});
				});
			break;
			case "leave":
				Server.wipeMessage(args.channelID, args.event.d.id,function(msg, error){
					if (Server.our.members[args.userID].roles.indexOf(Server.staffroleid) !== -1)
						return Server.respond(args.userID, 'Because you have the Staff role you will see the <#'+Server.channelids.nsfw+'> channel no matter what.\nIf you don\'t wand to be notified of new messages, right-click the channel and click `Mute #nsfw`');
					else if (Server.our.members[args.userID].roles.indexOf(Server.roleids['Pony Sauce']) === -1)
						return Server.respond(args.userID, 'You are not a member of the #nsfw channel. To join, send `/nsfw join` in any channel.\n(**Notice:** Messages sent in PMs are ignored!)');
					if (error){
						console.log('Error while removing Pony Sauce role from ' + args.userIdent);
						console.log(error);
					}

					Server.removeRole(args.userID, 'Pony Sauce').catch(err => {
						Server.respond(args.channelID, Server.addErrorMessageToResponse(err, `Failed to leave <#${Server.channelids.nsfw}> channel`));
					}).then(() => {
						Server.respond(Server.channelids.nsfw, util.replyTo(args.userID, 'left the channel'));
					});
				});
			break;
		}
	},
});
