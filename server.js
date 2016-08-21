var Discord = require('discord.io'),
	config = require('./config'),
	bot = new Discord.Client({
		autorun: true,
		token: config.TOKEN,
	}),
	chalk = require('chalk'),
	replyTo = function(userID, message){
		return "<@"+userID+"> "+message;
	},
	respond = function(channelID, message){
		return bot.sendMessage({
			to: channelID,
			message: message,
		});
	},
	request = require('request'),
	readline = require('readline'),
	rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	}),
	OurServer;

bot.on('ready', ready);

function ready() {
	var i;

	bot.setPresence({ idle_since: null });
	console.log('Logged in as '+bot.username);

	var serverIDs = Object.keys(bot.servers),
		getClientID = function(){
			if (typeof config.CLIENT_ID !== 'undefined')
				return config.CLIENT_ID;
			else rl.question('Enter app Client ID (or ^C to exit): ', function(answer){
				if (/\D/.test(answer))
					return console.log('> ID must be numeric, try again (or ^C to exit): ');
				rl.close();
				return answer;
			});
		},
		getAuthURL = function(){
			return 'https://discordapp.com/oauth2/authorize?client_id='+getClientID()+'&scope=bot&permissions=0';
		};
	if (serverIDs.length === 0){
		console.log('Bot is not part of any server. To join the bot to a server, get your client ID from https://discordapp.com/developers/applications/me and enter it below.');

		var openAuthPage = function(clientID){
			var url = getAuthURL();
			if (config.LOCAL){
				console.log('Opening default browser to authorization URL ('+url+')');
				var browser = require('opener')(url);
				browser.unref();
				browser.stdin.unref();
				browser.stdout.unref();
				browser.stderr.unref();
			}
			else console.log('Open '+url+' in your favourite browser to continue.');
			rl.question('When you\'re done, press enter to re-run script (or ^C to exit)', function(){
				console.log('Reconnecting...\n');
				bot.disconnect();
				bot.connect();
				ready();
			});
		};

		openAuthPage();
		return;
	}

	OurServer = bot.servers[config.SERVER_ID];
	if (typeof OurServer === 'undefined'){
		console.log('Could not find Our server, listing currently joined servers:\n');
		for (i=0; i<serverIDs.length; i++){
			var id = serverIDs[i];
			console.log('    '+id+' '+'('+bot.servers[id].name+')');
		}
		console.log('\nSet one of the IDs above as the SERVER_ID configuration option.\nTo join the bot to another server, visit '+getAuthURL());
		process.exit();
	}
	console.log('Found Our server!');

	var OurRoleIDs = {},
		OurChannelIDs = {},
		staffRoleID;
	for (i in OurServer.roles){
		if (!OurServer.roles.hasOwnProperty(i))
			continue;

		var role = OurServer.roles[i];
		OurRoleIDs[role.name] = role.id;
		if (typeof staffRoleID === 'undefined' && role.name === config.STAFFROLE_NAME)
			staffRoleID = role.id;
	}
	if (typeof staffRoleID === 'undefined')
		console.log('Staff role name must be set to enable admin-only functionality.');
	for (i in OurServer.channels){
		if (!OurServer.channels.hasOwnProperty(i))
			continue;

		var channel = OurServer.channels[i];
		OurChannelIDs[channel.name] = channel.id;
	}

	var isOwner = function(userID){
			return userID === config.OWNER_ID;
		},
		isStaff = function(userID){
			return OurServer.members[userID].roles.indexOf(staffRoleID) !== -1;
		},
		hasOwner = typeof config.OWNER_ID === 'string' && config.OWNER_ID.length,
		myIDran = false,
		limitedFunc = ', functionality is limited.\nUse the !myid command to get your ID';

	if (!hasOwner)
		console.log('Bot has no owner'+limitedFunc);
	else {
		if (typeof bot.users[config.OWNER_ID] === 'undefined'){
			hasOwner = false;
			console.log('The configured owner is not among the channel members'+limitedFunc);
		}
		else {
			var _owner = bot.users[config.OWNER_ID];
			console.log('Owner is '+_owner.username+' ('+_owner.id+')');
		}
	}

	console.log('And now, we wait...\n');

	function addErrorMessageToResponse(err, response){
		if (err)
			response += '\n('+(hasOwner?'<@'+config.OWNER_ID+'> ':'')+err.message+(err.response?': '+err.response.message:'')+')';
		return response;
	}

	function wipeMessage(channelID, messageID, response, userID){
		bot.deleteMessage({
			channelID: channelID,
			messageID: messageID,
		},function(err){
			var callback = function(msg){
				respond(channelID, userID ? replyTo(userID, msg) : msg);
			};
			if (typeof response === 'function'){
				callback = response;
				response = '';
			}
			response = addErrorMessageToResponse(err, response);
			callback(response, Boolean(err));
		});
	}

	function ProcessCommand(userID, channelID, message, event){
		var commandRegex = /^!(\w+)(?:\s+([ -~]+)?)?$/,
			user = bot.users[userID],
			userIdent = user.username+'#'+user.discriminator;
		console.log(userIdent+' ran '+message);
		if (!commandRegex.test(message))
			bot.sendMessage({
				to: channelID,
				message: replyTo(userID, 'Invalid command: '+(message.replace(/^(!\S+).*/,''))),
			});
		var commandMatch = message.match(commandRegex),
			command = commandMatch[1],
			args = commandMatch[2] ? commandMatch[2].split(/\s+/) : [];

		switch (command){
			case "channels":
				if (!isOwner(userID))
					respond(channelID, replyTo(userID, 'You must be owner to use this command'));

				var ids = [];
				for (var i in OurServer.channels){
					if (OurServer.channels.hasOwnProperty(i)){
						var channel = OurServer.channels[i];
						ids.push(channel.id+' ('+(channel.type==='text'?'#':'')+channel.name+')');
					}
				}
				respond(channelID, replyTo(userID, "Channels on this server:\n```"+ids.join('\n')+'```'));
			break;
			case "myid":
				if (!hasOwner){
					if (myIDran)
						return respond(channelID, replyTo(userID, 'This command can only be executed once per server start-up until the owner\'s ID is set'));
					else myIDran = true;
				}
				else if (!isOwner(userID))
					return respond(channelID, replyTo(userID, 'You must be owner to use this command'));

				respond(channelID, replyTo(userID, 'Your user ID was sent to you in a private message'));
				respond(userID, 'Your user ID is `'+userID+'`');
			break;
			case "casual":
				var url = config.OFFTOCASUAL_URL;
				if (!isNaN(args[0]))
					url += '/'+parseInt(args[0], 10)+'.png';
				else url += '?'+(Date.now().toString(36));
				wipeMessage(channelID, event.d.id, 'Please continue this discussion in <#'+OurChannelIDs.casual+'>\n'+url);
			break;
			case "cg":
				if (!args.length)
					return respond(channelID, replyTo(userID, 'This command can be used to quickly link to an appearance using the site\'s  "I\'m feeling lucky" search'));
				var query = args.join(' ');
				request.get('https://mlpvc-rr.ml/cg/1?js=true&q='+encodeURIComponent(query)+'&GOFAST=true', function(error, res, body){
					if (error || typeof body !== 'string'){
						console.log(error, body);
						return respond(channelID, replyTo(userID, 'Search failed. '+(hasOwner?'<@'+config.OWNER_ID+'>':'The bot owner')+' can see what caused the issue in the logs.'));
					}

					var data = JSON.parse(body);
					if (!data.status)
						return respond(channelID, replyTo(userID, data.message));

					wipeMessage(channelID, event.d.id, 'https://mlpvc-rr.ml'+data.goto);
				});
			break;
			case "nsfw":
				if (typeof OurServer.channels[channelID] !== 'undefined' && OurServer.channels[channelID].name === 'nsfw' && args[0] !== 'leave')
					return;
				if (!args.length)
					return wipeMessage(channelID, event.d.id, ('Please avoid discussing anything NSFW in <#'+channelID+'>. We have a dedicated invite-only NSFW channel, send `!nsfw join` to join. '+config.SAUCY_URL).trim());

				switch (args[0]){
					case "join":
						wipeMessage(channelID, event.d.id,function(msg, error){
							if (OurServer.members[userID].roles.indexOf(staffRoleID) !== -1)
								return respond(userID, 'Because you have the Staff role you will see the <#'+OurChannelIDs.nsfw+'> channel no matter what.\nIf you don\'t wand to be notified of new messages, right-click the channel and click `Mute #nsfw`');
							else if (OurServer.members[userID].roles.indexOf(OurRoleIDs['Pony Sauce']) !== -1)
								return respond(userID, 'You are already a member of the #nsfw channel. To leave, send `!nsfw leave` in any channel.\n(**Notice:** Messages sent in PMs are ignored!)');

							bot.addToRole({
								serverID: OurServer.id,
								userID: userID,
								roleID: OurRoleIDs['Pony Sauce'],
							},function(err){
								if (!err && error)
									console.log('Error while adding Pony Sauce role to '+userIdent+error);

								var response = err ? 'Failed to join <#'+OurChannelIDs.nsfw+'> channel' :'';

								response = addErrorMessageToResponse(err, response);

								if (response)
									return respond(channelID, response);

								OurServer.members[userID].roles.push(OurRoleIDs['Pony Sauce']);

								respond(OurChannelIDs.nsfw, replyTo(userID, 'Welcome aboard. If at any point you wish to leave the channel, use `!nsfw leave`'));
							});
						});
					break;
					case "leave":
						wipeMessage(channelID, event.d.id,function(msg, error){
							if (OurServer.members[userID].roles.indexOf(staffRoleID) !== -1)
								return respond(userID, 'Because you have the Staff role you will see the <#'+OurChannelIDs.nsfw+'> channel no matter what.\nIf you don\'t wand to be notified of new messages, right-click the channel and click `Mute #nsfw`');
							else if (OurServer.members[userID].roles.indexOf(OurRoleIDs['Pony Sauce']) === -1)
								return respond(userID, 'You are not a member of the #nsfw channel. To join, send `!nsfw join` in any channel.\n(**Notice:** Messages sent in PMs are ignored!)');

							bot.removeFromRole({
								serverID: OurServer.id,
								userID: userID,
								roleID: OurRoleIDs['Pony Sauce'],
							},function(err){
								if (!err && error)
									console.log('Error while removing Pony Sauce role from '+userIdent+error);

								var response = addErrorMessageToResponse(err, '');

								if (response)
									return respond(channelID, replyTo(userID, response));

								OurServer.members[userID].roles.splice(OurServer.members[userID].roles.indexOf(OurRoleIDs['Pony Sauce']), 1);

								respond(OurChannelIDs.nsfw, replyTo(userID, 'left the channel'));
							});
						});
					break;
				}
			break;
		}
	}

	function ProfanityFilter(userID, channelID, message, event){
		var matching = /\b(f+[u4a]+[Ссc]+k+(?:tard|[1i]ng)?|[Ссc]un[7t]|a[5$s]{2,}(?:h[0o]+l[3e]+)|(?:d[1i]+|[Ссc][0o])[Ссc]k(?:h[3e][4a]*d)?|b[1ie3a4]+t[Ссc]h|sh[1ie]+t)\b/ig,
			user = bot.users[userID];

		if (!matching.test(message))
			return;

		console.log(user.username+'#'+user.discriminator+' triggered profanity filter with message: '+(message.replace(matching,function(str){
			return chalk.red(str);
		})));

		wipeMessage(channelID, event.d.id, 'Please avoid using swear words.', userID);
	}

	function onMessage(_, userID, channelID, message, event) {
		var args = [].slice.call(arguments,1);
		if (/^!/.test(message))
			return ProcessCommand.apply(this, args);

		ProfanityFilter.apply(this, args);
	}
	bot.on('message', onMessage);

	bot.on('messageUpdate', function(_, newMsg, event){
		if (typeof newMsg.author === 'undefined')
			return;
		onMessage(null, newMsg.author.id, newMsg.channel_id, newMsg.content, event);
	});

	bot.on('disconnect', function(errMsg, code){
		console.log('[DISCONNECT:'+code+'] '+errMsg);
		process.exit();
	});

	process.on('SIGINT', function(){
		idle();
		process.exit();
	});
	process.on('exit', idle);
	function idle(){
		bot.setPresence({ idle_since: Date.now() });
	}
}
