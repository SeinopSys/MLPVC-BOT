const
	fs = require('fs'),
	table = require('text-table'),
	Command = require('../classes/Command'),
	Server = require('../classes/Server');

module.exports = new Command({
	name: 'help',
	help:
		'Displays a list of available commands. Takes a command name as an additional parameter to provide detailed information on that specific command.\n' +
		'If a command is specified as the first parameter and the second parameter is `here` the help text will be output inside the current channel instead of being sent via a PM (the parameter does nothing when the command is called via PM).',
	perm: 'everyone',
	usage: [true, 'google', 'cg', 'ver here'],
	allowPM: true,
	action: async args => {
		if (typeof args.argArr[0] === 'string'){
			let tcmd = args.argArr[0],
				here = args.argArr[1] === 'here' && !args.isPM,
				targetChannel = here ? args.channel : args.author;
			if (!args.isPM && !here)
				Server.wipeMessage(args.message);
			if (!/^[a-z]+$/.test(tcmd))
				return Server.send(targetChannel, `Invalid command (\`${tcmd}\`). You can get a list of available comands by running \`/help\``);
			if (!Server.commandExists(tcmd) || (!Server.commandPermCheck(tcmd, args.authorID) && !(await Server.perm.isStaff.check(args.authorID)))){
				return Server.send(targetChannel, `The specified command (\`${tcmd}\`) does not exist${!(await Server.perm.isStaff.check(args.authorID)) ? " or you don't have permission to use it" : ''}.`);
			}

			let cmd = Server.getCommand(tcmd);
			if (typeof cmd.help !== 'string'){
				if (!args.isPM && !here)
					Server.wipeMessage(args.message);
				Server.send(targetChannel, `The specified command (${cmd.name}) has no associated help text.`);
			}

			let usage = [];
			if (cmd.usage){
				if (typeof cmd.usage === 'string')
					usage = cmd.usage;
				else
					for (let j=0; j<cmd.usage.length; j++)
						usage.push('/'+cmd.name+(cmd.usage[j]===true?'':' '+cmd.usage[j]));
			}
			return Server.send(targetChannel,
				'Showing help for command `'+cmd.name+'`'+(here?' (force-displayed)':'')+'\n'+
				'__Usable by:__ '+Server.perm[cmd.perm].name+'\n'+
				'__Usable in:__ '+(cmd.allowPM?"Server's channels and PMs":"Server's channels only (no PMs)")+'\n'+
				'__Description:__\n'+(cmd.help.replace(/^(.)/gm,'\t\t$1'))+
				(cmd.aliases?'\n__Aliases:__ `'+(cmd.aliases.join('`, `'))+'`':'')+
				(usage.length?(typeof usage === 'string' ? `\n__Usage:__ ${usage}` : '\n__Usage, examples:__\n```\n'+(usage.join('\n'))+'\n```'):'')
			);
		}
		let canrun = [];
		fs.readdirSync('commands').forEach(file => {
			let cmd = require(`./${file}`);
			if (false === cmd instanceof Command)
				return;

			if (Server.perm[cmd.perm].check(args.authorID))
				canrun.push(cmd.name);
		});
		canrun = canrun.sort(function(a,b){
			return a.localeCompare(b);
		});
		let exampleCommand = canrun[Math.floor(Math.random()*canrun.length)],
			msg = 'Commands must be prefixed with `!` or `/` when sent in one of the channels, and all command names are case-insensitive (meaning `/'+exampleCommand
				+'` is the same as `/'+(exampleCommand.replace(/^(.)/,function(a){
					return a.toUpperCase();
				}))+'` or `/'+(exampleCommand.toUpperCase())+'`).\n'+
				'Here\'s a list of all commands __you__ can run:\n```\n',
			commandsTable = [],
			columns = 3;
		for (let ix=0; ix<canrun.length; ix+=columns)
			commandsTable.push(canrun.slice(ix,ix+columns));

		msg += table(commandsTable,{ hsep: '  ' });

		if (!args.isPM)
			Server.wipeMessage(args.message);
		Server.send(args.author, msg.trim()+'\n```\nIf you want to find out what a specific command does, simply run `/help commandname` (e.g. `/help '+exampleCommand+'`)');
	}
});
