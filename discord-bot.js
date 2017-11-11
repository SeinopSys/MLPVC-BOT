// jshint -W014
'use strict';
const
	unirest = require('unirest'),
	moment = require('moment'),
	chalk = require('chalk'),
	config = require('./config'),
	Server = require('./classes/Server'),
	Command = require('./classes/Command'),
	util = require('./shared-utils');
Array.prototype.randomElement = function(){ return this[Math.floor(Math.random() * this.length)] };

if (config.LOCAL === true && /^https:/.test(config.SITE_ABSPATH))
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

require("console-stamp")(console, {
	formatter: function(){
		return moment().format('YYYY-MM-DD HH:MM:ss.SSS');
	},
	label: false,
});

Server.makeBot();

Server.bot.on('ready', function ready(){
	Server.account();

	function callCommand(userID, channelID, message, event, userIdent, command, argStr, argArr, silentFail){
		let isPM = channelID in Server.bot.directMessages;
		command = command.toLowerCase();

		if (command === 'join' && argStr.trim().toLowerCase() === 'nsfw'){
			command = 'nsfw';
			argStr = 'join';
			argArr = [argStr];
		}

		switch (command){
			// Ignore Discord's own commands
			case "gamerscape":
			case "xvidb":
			case "giphy":
			case "tenor":
			case "me":
			case "tableflip":
			case "unflip":
			case "shrug":
			case "nick":
			case "say": return;
		}

		if (!Server.commandExists(command)){
			if (silentFail){
				console.log(`Command /${command} does not exist, silently ignored`);
				return;
			}
			let notfound = `Command \`/${command}\` not found`;
			console.log(notfound);
			Server.respond(channelID, util.replyToIfNotPM(isPM, userID, `${notfound}. Use \`/help\` to see a list of all available commands`));
			return;
		}

		const cmd = Server.getCommand(command);
		if (!(cmd instanceof Command)){
			Server.respond(channelID, util.replyToIfNotPM(isPM, userID, `Command file \`${command}.js\` is exporting an invalid value`+(Server.hasOwner ? '\n'+Server.mentionOwner(userID)+' should see what caused this issue' : '')));
			return;
		}
		if (typeof cmd.action !== 'function'){
			Server.respond(channelID, util.replyToIfNotPM(isPM, userID, `The specified command has no associated action`));
			return;
		}
		cmd.action({ userID, channelID, message, event, userIdent, command, argStr, argArr, isPM });
	}

	function processCommand(userID, channelID, message, event){
		let isPM = channelID in Server.bot.directMessages || !(channelID in Server.bot.channels),
			commandRegex = /^\s*[!/](\w+)(?:\s+([ -~]+|`(?:``(?:js)\n)?[\S\s]+`(?:``)?)?)?$/,
			userIdent = Server.getIdent(userID);
		console.log(userIdent+' ran '+message+' from '+(isPM?'a PM':chalk.blue('#'+Server.bot.channels[channelID].name)));
		if (!commandRegex.test(message)){
			let matchingCommand = message.match(/^([!/]?\S+)/);
			return Server.bot.sendMessage({
				to: channelID,
				message: util.replyTo(userID, 'Invalid command'+(matchingCommand ? ': '+matchingCommand[1] : '')),
			});
		}
		let commandMatch = message.match(commandRegex);
		if (!commandMatch)
			return;
		const
			command = commandMatch[1],
			argStr = commandMatch[2] ? commandMatch[2].trim() : '',
			argArr = argStr ? argStr.split(/\s+/) : [],
			silentFail = message[0] === '/';

		callCommand(userID, channelID, message, event, userIdent, command, argStr, argArr, silentFail);
	}

	let interactions = {
		cgfound: [
			'Looking for this?',
			"I've got you covered:",
			"_smashes Enter_",
		],
		cgnotfound: [
			"*shakes head*",
			"Nu-uh",
			"Nope",
			"Nah",
		],
		cgSunset: [
			"It's in the plans, but the iTunes Raw 1080p version isn't available yet. PLease be patient, we'll let everyone know when it's done.",
			"Not yet, but it's on our radar.",
			"There isn't one yet, but rest assured it'll be made as soon as we can pick accurate colors for her.",
			"Patience is a virtue.",
		],
	};
	function interact(userID, channelID, message){
		const
			userIdent = Server.getIdent(userID),
			isPM = !(channelID in Server.bot.channels);
		if (isPM)
			console.log('PM interaction initiated by '+userIdent+', message: '+message);

		let normalized = message.toLowerCase(),
			normalizedParts = normalized.split(/\s+/);
		normalized = normalizedParts.join(' ');

		let cgtest = /^(?:(?:is|si) t(?:he|eh)re|(?:d(?:o|id) |(?:no|nah|(?:I )?don't think so),? but )?we? (do )?ha(?:ev|ve)) a (?:(?:colou?r ?)?gui?de for (?:(?:(?:th|ht)[ew]|a|an) )?([\w\s]+)|([\w\s]+?) (?:colou?r ?)?gui?de)\??$/;
		if (cgtest.test(normalized)){
			Server.bot.simulateTyping(channelID);
			let match = normalized.match(cgtest),
				eqgTest = /\b(human|eqg|eq(?:uestria)? girls)\b/i,
				query = (match[1]||match[2]).replace(eqgTest, '').trim(),
				eqg = eqgTest.test(normalized);

			if (!eqg && /\bsunset(?:\s?shimmer)?/.test(query))
				return Server.respond(channelID, util.replyToIfNotPM(isPM, userID, interactions.cgSunset.randomElement()));

			unirest.get(config.SITE_ABSPATH+'cg'+(eqg?'/eqg':'')+'/1?js=true&q='+encodeURIComponent(query)+'&GOFAST=true')
				.header("Accept", "application/json")
				.end(function (result) {
					if (result.error || typeof result.body !== 'object'){
						console.log(result.error, result.body);
						return Server.respond(channelID, util.replyToIfNotPM(isPM, userID, 'I could not check it right now. '+Server.mentionOwner(userID)+' should see why in the logs.'));
					}

					let data = result.body;

					if (!data.status){
						console.log('Color guide not found for "'+query+'" because: '+data.message);
						if (data.unavail === true)
							return;
						return Server.respond(channelID, util.replyToIfNotPM(isPM, userID, interactions.cgnotfound.randomElement()));
					}

					Server.respond(channelID, util.replyToIfNotPM(isPM, userID, interactions.cgfound.randomElement()+' '+config.SITE_ABSPATH+(data.goto.substring(1))));
				});
			return;
		}

		let informedtest = /^(?:.*?\b)?(?:why(?:(?:'?s| is) there|(?: do (?:you|we) )?(even )?have) an?|what(?:'?s| is) the(?: (?:purpose|reason) (?:of|for(?: having)?|behind) the)?) ['"]?informed['"]? role\??$/i;
		if (informedtest.test(normalized)){
			Server.respond(channelID, util.replyToIfNotPM(isPM, userID, "The purpose of the Informed role is to distinguish users who've read the server rules in the <#"+Server.channelids.welcome+"> channel. Once new users run the `/read` command mentioned in said channel, they will be given this role, which grants them access to view and chat in all other channels. Members who have already been part of the server at the time this change was introduced were given this role manually to spare them the hassle of reading the rules they were already familiar with."));
			//return;
		}
	}

	function onMessage(_, userID, channelID, message, event) {
		if (userID === Server.bot.id)
			return;

		let isPM = channelID in Server.bot.directMessages;

		let args = [].slice.call(arguments,1),
			callHandler = function(){
				if (channelID === Server.channelids.welcome){
					Server.wipeMessage(channelID, event.d.id);
					if (message.trim().indexOf('/read') === 0){
						Server.bot.addToRole({
							serverID: Server.our.id,
							userID: userID,
							roleID: Server.roleids.Informed,
						},function(err){
							if (err){
								console.log('Error while adding Informed role to '+Server.getIdent(userID));
								console.lg(err);
								return Server.respond(Server.channelids.staffchat, `Failed to add Informed role to <@${userID}>`);
							}

							let response = err ? 'Failed to add Informed role' :'';

							response = Server.addErrorMessageToResponse(err, response);

							if (response)
								return Server.respond(channelID, response);

							Server.respond(Server.channelids.casual, `Please welcome <@${userID}> to our server!`, function(){
								// Force a restart to update members in the script
								console.log('New user joining');
								//process.exit();
							});
						});
						return;
					}
					else if (!Server.perm.isStaff.check(userID) || message.trim().indexOf('/edit') !== 0){
						// Notify in a PM if not already informed
						if (!Server.perm.informed.check(userID))
							Server.respond(userID, `You will not be able to chat on our server until you've read the rules in <#${Server.channelids.welcome}>.`);
						return;
					}
					// If the user is Staff and the message being sent starts with /edit then we allow it through
				}
				if (/^\s*[!/]\w+/.test(message))
					return processCommand.apply(this, args);
				interact.apply(this, args);
			};

		if (!isPM)
			callHandler();
		else if (channelID in Server.bot.directMessages){
			if (!(userID in Server.our.members))
				return Server.respond(channelID, 'You must be a member of the '+Server.our.name+' Discord server to use this bot!');

			console.log('Received PM from @'+Server.getIdent(userID)+' ('+userID+'), contents:\n'+message);

			callHandler();
		}
	}
	Server.bot.on('message', onMessage);

	Server.bot.on('messageUpdate', function(_, newMsg, event){
		if (typeof newMsg.author === 'undefined')
			return;
		onMessage(null, newMsg.author.id, newMsg.channel_id, newMsg.content, event);
	});

	if (Server.hasOwner){
		if (config.LOCAL)
			Server.bot.setPresence({ game: { name: 'a local  version' } });
		else Server.getVersion(config.OWNER_ID,config.OWNER_ID,function(ver){
			Server.bot.setPresence({ game: { name: 'version '+ver } });
		});
	}

	Server.bot.on('disconnect', function(errMsg, code){
		console.log('[DISCONNECT:'+code+'] '+errMsg);
		setTimeout(function(){
			process.exit();
		}, 5000);
	});

	process.on('SIGINT', function(){
		console.log(chalk.red('Interrupt signal received'));
		Server.idle();
		setTimeout(function(){
			process.exit();
		}, 10);
	});
	process.on('exit', Server.idle);
});
