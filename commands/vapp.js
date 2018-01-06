const
	Command = require('../classes/Command'),
	Server = require('../classes/Server'),
	util = require('../shared-utils');

module.exports = new Command({
	name: 'vapp',
	help: 'Adds and removes roles related to vector apps. Use `+` or `-` before an app name to indicate add/remove.\nApp names:\n\t- `is`: Inkscape\n\t- `ai`: Illustrator',
	perm: 'everyone',
	usage: ['+ai', '+ai -is', '-is -ai'],
	allowPM: true,
	action: args =>{
		if (args.argArr.length < 1)
			return Server.reply(args.message, 'This command requires at least 1 argument');
		if (args.argArr.length > 2)
			return Server.reply(args.message, 'This command does not accept more than 2 arguments');
		const action = (which, role) =>{
			return new Promise(resolve =>{
				switch (which){
					case '+':
						Server.addRole(args.author, role).catch(err =>{
							Server.reply(args.message, util.addErrorMessageToResponse(err, `Failed to add ${role} role to ${Server.mention(args.author)}`));
						}).then(resolve);
					break;
					case '-':
						Server.removeRole(args.author, role).catch(err =>{
							Server.reply(args.message, util.addErrorMessageToResponse(err, `Failed to remove ${role} role from ${Server.mention(args.author)}`));
						}).then(resolve);
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
				Server.reply(args.message, 'Invalid argument: `' + arg + '`');
				return (cont = false);
			}

			const role = rolemap[match[2]];
			if (typeof role !== 'undefined'){
				rolemap[match[2]] = void 0;
			}
			else {
				Server.reply(args.message, 'You may only specify one action per role');
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
			return Server.reply(args.message, 'No valid arguments passed');
		(function recurse(i){
			const el = actions[i];
			if (typeof el === 'undefined')
				return Server.reply(args.message, 'Roles updated');
			action(el.which, el.role).catch(() => void 0).then(() =>{
				setTimeout(() => recurse(i + 1), 500);
			});
		})(0);
	},
});
