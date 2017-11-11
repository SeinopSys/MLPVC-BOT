const
	Command = require('../classes/Command'),
	Server = require('../classes/Server'),
	util = require('../shared-utils');

module.exports = new Command({
	name: 'vapp',
	help: 'Adds and removes roles related to vector apps. Use `+` or `-` before an app name to indicate add/remove.\nApp names:\n\t- `is`: Inkscape\n\t- `ai`: Illustrator',
	perm: 'everyone',
	usage: ['+ai', '+ai -is', '-is -ai'],
	action: args =>{
		if (args.argArr.length < 1)
			return Server.respond(args.channelID, util.replyToIfNotPM(args.isPM, args.userID, 'This command requires at least 1 argument'));
		if (args.argArr.length > 2)
			return Server.respond(args.channelID, util.replyToIfNotPM(args.isPM, args.userID, 'This command does not accept more than 2 arguments'));
		const action = (which, role) =>{
			return new Promise(fulfill =>{
				switch (which){
					case '+':
						Server.addRole(args.userID, role).catch(err =>{
							Server.respond(args.channelID, util.addErrorMessageToResponse(err, 'Failed to add <@&'+role+'> role to <@'+args.userID+'>'));
						}).then(() =>{
							fulfill();
						});
						break;
					case '-':
						Server.removeRole(args.userID, role).catch(err =>{
							Server.respond(args.channelID, util.addErrorMessageToResponse(err, 'Failed to remove <@&'+role+'> role from <@'+args.userID+'>'));
						}).then(() =>{
							fulfill();
						});
						break;
				}
			});
		};

		const
			rolemap = {
				ai: 'Illustrator',
				is: 'Inkscape',
			},
			actions = [];
		let cont = true;
		args.argArr.forEach(arg =>{
			const match = arg.match(/^([+-])(ai|is)$/);
			if (!match){
				Server.respond(args.channelID, util.replyToIfNotPM(args.isPM, args.userID, 'Invalid argument: `' + arg + '`'));
				return (cont = false);
			}

			const role = rolemap[match[2]];
			if (typeof role !== 'undefined'){
				rolemap[match[2]] = void 0;
			}
			else {
				Server.respond(args.channelID, util.replyToIfNotPM(args.isPM, args.userID, 'You may only specify one action per role'));
				return (cont = false);
			}

			actions.push({
				which: match[1],
				role,
			});
		});
		if (!cont)
			return;
		if (!actions.length)
			return Server.respond(args.channelID, util.replyToIfNotPM(args.isPM, args.userID, 'No valid arguments passed'));
		(function recurse(i){
			const el = actions[i];
			if (typeof el === 'undefined')
				return Server.respond(args.channelID, util.replyToIfNotPM(args.isPM, args.userID, 'Roles updated'));
			action(el.which, el.role).catch(() => void 0).then(() =>{
				setTimeout(() => recurse(i + 1), 500);
			});
		})(0);
	},
});
