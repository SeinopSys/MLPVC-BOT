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
	action: args => {
		if (typeof args.argArr[0] === 'string'){
			let tcmd = args.argArr[0],
				here = args.argArr[1] === 'here' && !args.isPM,
				targetChannel = here ? args.channelID : args.userID;
			if (!args.isPM && !here)
				Server.wipeMessage(args.channelID, args.event.d.id);
			if (!/^[a-z]+$/.test(tcmd))
				return Server.respond(targetChannel, 'Invalid command (`'+tcmd+'`). You can get a list of available comands by running `/help`');
			if (!Server.commandExists(tcmd) || (!Server.commandPermCheck(tcmd, args.userID) && !Server.perm.isStaff.check(args.userID))){
				return Server.respond(targetChannel, 'The specified command (`'+tcmd+'`) does not exist'+(!Server.perm.isStaff.check(args.userID)?' or you don\'t have permission to use it':'')+'.');
			}

			let cmd = Server.getCommand(tcmd);
			if (typeof cmd.help !== 'string'){
				if (!args.isPM && !here)
					Server.wipeMessage(args.channelID, args.event.d.id);
				Server.respond(targetChannel, 'The specified command ('+cmd.name+') has no associated help text.');
			}

			let usage = [];
			if (cmd.usage){
				if (typeof cmd.usage === 'string')
					usage = cmd.usage;
				else
					for (let j=0; j<cmd.usage.length; j++)
						usage.push('/'+cmd.name+(cmd.usage[j]===true?'':' '+cmd.usage[j]));
			}
			return Server.respond(targetChannel,
				'Showing help for command `'+cmd.name+'`'+(here?' (force-displayed)':'')+
				'\n__Usable by:__ '+Server.perm[cmd.perm].name+'\n'+
				'__Description:__\n'+(cmd.help.replace(/^(.)/gm,'\t\t$1'))+
				(cmd.aliases?'\n__Aliases:__ `'+(cmd.aliases.join('`, `'))+'`':'')+
				(usage.length?(typeof usage === 'string' ? `\n__Usage:__ ${usage}` : '\n__Usage, examples:__\n```\n'+(usage.join('\n'))+'\n```'):'')
			);
		}
		let canrun = [];
		fs.readdirSync('commands').forEach(file => {
			let cmd = require('./'+file);
			if (!(cmd instanceof Command))
				return;

			if (Server.perm[cmd.perm].check(args.userID))
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
			Server.wipeMessage(args.channelID, args.event.d.id);
		Server.respond(args.userID, msg.trim()+'\n```\nIf you want to find out what a specific command does, simply run `/help commandname` (e.g. `/help '+exampleCommand+'`)');
	}
});
