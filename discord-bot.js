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
	rl,
	getRl = function(){
		if (typeof rl === 'undefined')
			rl = readline.createInterface({
				input: process.stdin,
				output: process.stdout
			});
		return rl;
	},
	moment = require('moment'),
	YouTube = require('youtube-node'),
	yt = new YouTube(),
	OurServer;

yt.setKey(config.YT_API_KEY);

require("console-stamp")(console, {
	formatter: function(){
		return moment().format('YYYY-MM-DD HH:MM:ss.SSS');
	},
	label: false,
});

bot.on('ready', ready);

function ready(){
	var i;

	bot.setPresence({ idle_since: null });
	console.log('Logged in as '+bot.username);

	var serverIDs = Object.keys(bot.servers),
		getClientID = function(){
			if (typeof config.CLIENT_ID !== 'undefined')
				return config.CLIENT_ID;
			else getRl().question('Enter app Client ID (or ^C to exit): ', function(answer){
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
			getRl().question('When you\'re done, press enter to re-run script (or ^C to exit)', function(){
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
	console.log('Found Our server ('+OurServer.name+')');

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
		limitedFunc = ', functionality is limited.\nUse the /myid command to get your ID';

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

	function CallCommand(userID, channelID, message, event, userIdent, command, argStr, args){
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
			case "editme":
				bot.editMessage({
					channelID: channelID,
					messageID: event.d.id,
					message: 'This message was edited by the chat bot.',
				},function(err){
					var response = 'Edit attempt';

					response = addErrorMessageToResponse(err, response);

					respond(channelID, replyTo(userID, response));
				});
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
			case "ver":
				bot.simulateTyping(channelID);

				var exec = require('child_process').exec;
				exec('git rev-parse --short=4 HEAD', function(_, version) {
					if (_){
						console.log('Error getting version', _);
						return respond(channelID, replyTo(userID, 'Error while getting version number'+(hasOwner?' (<@'+config.OWNER_ID+'> Logs may contain more info)':'')));
					}
					exec('git log -1 --date=short --pretty=format:%ci', function(_, ts) {
						if (_){
							console.log('Error getting creation time', _);
							return respond(channelID, replyTo(userID, 'Error while getting creation time'+(hasOwner?' (<@'+config.OWNER_ID+'> Logs may contain more info)':'')));
						}

						var ver = version.trim();
						respond(channelID, replyTo(userID, 'Bot is running version `'+ver+'` created '+(moment(ts).fromNow())+'\nView commit on GitHub: http://github.com/ponydevs/MLPVC-BOT/commit/'+ver));
					});
				});

			break;
			case "casual":
				var possible_images = [
						'http://i.imgur.com/C7T0npq.png', // Original by DJDavid98
						'http://i.imgur.com/RwnT8EX.png', // Coco & Rarity by Pirill
						'http://i.imgur.com/qg9Y1LN.png', // Applebloom's new CM by Drakizora
						'http://i.imgur.com/cxCzsB8.png', // Applebloom falling by Drakizora
						'http://i.imgur.com/iUZe3O2.png', // CMs floating around Applebloom by Drakizora
					],
					image_count = possible_images.length,
					data = args[0],
					k;

				if (!isNaN(data))
					k = Math.max(0,Math.min(image_count-1,parseInt(data, 10)-1));
				else {
					k = moment().minutes() % image_count;
				}

				wipeMessage(channelID, event.d.id, 'Please continue this discussion in <#'+OurChannelIDs.casual+'>\n'+possible_images[k]);
			break;
			case "cg":
				if (!args.length)
					return respond(channelID, replyTo(userID, 'This command can be used to quickly link to an appearance using the site\'s  "I\'m feeling lucky" search'));

				bot.simulateTyping(channelID);
				request.get('https://mlpvc-rr.ml/cg/1?js=true&q='+encodeURIComponent(argStr)+'&GOFAST=true', function(error, res, body){
					if (error || typeof body !== 'string'){
						console.log(error, body);
						return respond(channelID, replyTo(userID, 'Color Guide search failed (HTTP '+res.statusCode+'). '+(hasOwner?'<@'+config.OWNER_ID+'>':'The bot owner')+' should see what caused the issue in the logs.'));
					}

					var data = JSON.parse(body);
					if (!data.status)
						return respond(channelID, replyTo(userID, data.message));

					respond(channelID, replyTo(userID, 'https://mlpvc-rr.ml'+data.goto));
				});
			break;
			case "kym":
				command = 'google';
				argStr = 'kym '+argStr;
				args.splice(0,0,['kym']);

				return CallCommand(userID, channelID, message, event, command, argStr, args);
			case "google":
				if (!args.length)
					return respond(channelID, replyTo(userID, 'This command can be used to perform an "I\'m feeling lucky" Google search and return the first result.'));
				bot.simulateTyping(channelID);
				var searchUrl = 'https://google.com/search?q='+encodeURIComponent(argStr);
				request.head(searchUrl+'&btnI', {followRedirect:function(res){
					if (typeof res.headers.location !== 'string')
						return true;

					return /(www\.)google\.((co\.)?[a-z]+)/.test(require('url').parse(res.headers.location).host);
				}}, function(error, res, body){
					if (error || typeof body !== 'string' || [302, 200].indexOf(res.statusCode) === -1){
						console.log(error, body);
						return respond(channelID, replyTo(userID, 'Google search failed (HTTP '+res.statusCode+'). '+(hasOwner?'<@'+config.OWNER_ID+'>':'The bot owner')+' should see what caused the issue in the logs.'));
					}

					if (typeof res.headers.location === 'string')
						return respond(channelID, replyTo(userID, res.headers.location));

					respond(channelID, replyTo(userID, 'No obvious first result. Link to search page: '+searchUrl));
				});
			break;
			case "youtube":
			case "yt":
				if (!args.length)
					return respond(channelID, replyTo(userID, 'This command can be used to return the first result of a YouTube search'));
				bot.simulateTyping(channelID);
				yt.addParam('type', 'video');
				yt.addParam('regionCode', 'US');
				yt.addParam('relevanceLanguage', 'en');
				yt.search(argStr, 1, function(error, result) {
					if (error || typeof result.items === 'undefined'){
						console.log(error, result.items);
						return respond(channelID, replyTo(userID, 'YouTube search failed. '+(hasOwner?'<@'+config.OWNER_ID+'>':'The bot owner')+' should see what caused the issue in the logs.'));
					}

					if (typeof result.items[0] === 'undefined' || typeof result.items[0].id.videoId === 'undefined')
						return respond(channelID, replyTo(userID, 'YouTube search returned no results.'));

					respond(channelID, replyTo(userID, 'https://youtube.com/watch?v='+result.items[0].id.videoId));
				});
			break;
			case "derpi":
				if (!args.length)
					return respond(channelID, replyTo(userID, 'This command can be used to return the first result of a Derpibooru search.\n**Note:** Any rooms aside from #nsfw will only show results with the `safe` tag'));

				bot.simulateTyping(channelID);
				var query = argStr;
				if (channelID !== OurChannelIDs.nsfw)
					query = '('+query+') && safe';
				request.get('https://derpibooru.org/search.json?q='+encodeURIComponent(query), function(error, res, body){
					if (error || typeof body !== 'string'){
						console.log(error, body);
						return respond(channelID, replyTo(userID, 'Derpibooru search failed (HTTP '+res.statusCode+'). '+(hasOwner?'<@'+config.OWNER_ID+'>':'The bot owner')+' should see what caused the issue in the logs.'));
					}

					var data = JSON.parse(body);
					if (typeof data.search === 'undefined' || typeof data.search[0] === 'undefined')
						return respond(channelID, replyTo(userID, 'Derpibooru search returned no results.'));

					var image = data.search[0];
					if (!image.is_rendered){
						var tries = typeof this.tries === 'undefined' ? 1 : this.tries;
						if (tries > 2)
							return respond(channelID, replyTo(userID, 'The requested image is not yet processed by Derpibooru, please try again in a bit'));
						return setTimeout(function(){
							CallCommand.call({ tries: tries+1}, userID, channelID, message, event, userIdent, command, argStr, args);
						}, 1000);
					}

					respond(channelID, replyTo(userID, 'http://derpibooru.org/'+image.id+'\nhttps:'+image.image));
				});
			break;
			case "nsfw":
				if (typeof OurServer.channels[channelID] !== 'undefined' && OurServer.channels[channelID].name === 'nsfw' && args[0] !== 'leave')
					return;
				if (!args.length)
					return wipeMessage(channelID, event.d.id, ('Please avoid discussing anything NSFW in <#'+channelID+'>. We have a dedicated invite-only NSFW channel, send `/nsfw join` to join. http://i.imgur.com/jaNBZ09.gif').trim());

				switch (args[0]){
					case "join":
						wipeMessage(channelID, event.d.id,function(msg, error){
							if (OurServer.members[userID].roles.indexOf(staffRoleID) !== -1)
								return respond(userID, 'Because you have the Staff role you will see the <#'+OurChannelIDs.nsfw+'> channel no matter what.\nIf you don\'t wand to be notified of new messages, right-click the channel and click `Mute #nsfw`');
							else if (OurServer.members[userID].roles.indexOf(OurRoleIDs['Pony Sauce']) !== -1)
								return respond(userID, 'You are already a member of the #nsfw channel. To leave, send `/nsfw leave` in any channel.\n(**Notice:** Messages sent in PMs are ignored!)');

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

								respond(OurChannelIDs.nsfw, replyTo(userID, 'Welcome aboard. If at any point you wish to leave the channel, use `/nsfw leave`'));
							});
						});
					break;
					case "leave":
						wipeMessage(channelID, event.d.id,function(msg, error){
							if (OurServer.members[userID].roles.indexOf(staffRoleID) !== -1)
								return respond(userID, 'Because you have the Staff role you will see the <#'+OurChannelIDs.nsfw+'> channel no matter what.\nIf you don\'t wand to be notified of new messages, right-click the channel and click `Mute #nsfw`');
							else if (OurServer.members[userID].roles.indexOf(OurRoleIDs['Pony Sauce']) === -1)
								return respond(userID, 'You are not a member of the #nsfw channel. To join, send `/nsfw join` in any channel.\n(**Notice:** Messages sent in PMs are ignored!)');

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
			default:
				var isProfanity = ProfanityFilter(userID, channelID, message, event);
				if (!isProfanity){
					var notfound = 'Command /'+command+' not found';
					console.log(notfound);
					bot.sendMessage({
						to: channelID,
						message: replyTo(userID, notfound),
					});
				}
		}
	}

	function ProcessCommand(userID, channelID, message, event){
		var commandRegex = /^[!/](\w+)(?:\s+([ -~]+)?)?$/,
			user = bot.users[userID],
			userIdent = user.username+'#'+user.discriminator;
		console.log(userIdent+' ran '+message);
		if (!commandRegex.test(message))
			bot.sendMessage({
				to: channelID,
				message: replyTo(userID, 'Invalid command: '+(message.replace(/^([!/]\S+).*/,''))),
			});
		var commandMatch = message.match(commandRegex),
			command = commandMatch[1],
			argStr = commandMatch[2] ? commandMatch[2].trim() : '',
			args = argStr ? argStr.split(/\s+/) : [];

		CallCommand(userID, channelID, message, event, userIdent, command, argStr, args);
	}

	function ProfanityFilter(userID, channelID, message, event){
		if (userID === bot.id || isStaff(userID))
			return;

		var matching = /\b(f+[u4a]+[Ссc]+k+(?:tard|[1i]ng)?|[Ссc]un[7t]|a[5$s]{2,}(?:h[0o]+l[3e]+)|(?:d[1i]+|[Ссc][0o])[Ссc]k(?:h[3e][4a]*d)?|b[1ie3a4]+t[Ссc]h)\b/ig,
			user = bot.users[userID],
			ident = user.username+'#'+user.discriminator;

		if (!matching.test(message))
			return false;

		console.log(ident+' triggered profanity filter in channel '+chalk.blue('#'+bot.channels[channelID].name)+' with message: '+(message.replace(matching,function(str){
			return chalk.red(str);
		})));

		if (channelID === OurChannelIDs.nsfw){
			console.log(ident+' wasn\'t warned because they cursed in the NSFW channel');
			return false;
		}

		wipeMessage(channelID, event.d.id, function(msg){
			msg = 'Please avoid using swear words.\nYour message (shown below) in <#'+channelID+'> contained inapproperiate language and it was promptly removed.'+msg+'\n\n**Original message:**\n'+(message.replace(matching,'__*$1*__'));
			respond(userID, msg);
		});
		return true;
	}

	function onMessage(_, userID, channelID, message, event) {
		if (typeof OurServer.channels[event.d.channel_id] === 'undefined')
			return;

		var args = [].slice.call(arguments,1);
		if (/^[!/]/.test(message))
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
