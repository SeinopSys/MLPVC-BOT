const
	Discord = require('discord.js'),
	fs = require('fs'),
	exec = require('child_process').exec,
	Permission = require('./Permission'),
	util = require('../shared-utils'),
	Command = require('./Command'),
	config = require('../config'),
	unirest = require('unirest'),
	shellescape = require('shell-escape');

class Server {
	constructor(){
		this.perm = {
			isOwner: new Permission('Bot Developer', userID => {
				return userID === config.OWNER_ID;
			}),
			isStaff: new Permission('Staff', userID => {
				return this.findMember(userID).roles.exists('id', this.staffroleid);
			}),
			isMember: new Permission('Club Members', userID => {
				return this.findMember(userID).roles.exists('name', 'Club Members');
			}),
			everyone: new Permission('Everyone',function(){ return true }),
			nonmembers: new Permission('Non-members', userID => {
				return !this.perm.isStaff.check(userID) && !this.perm.isMember.check(userID);
			}),
			informed: new Permission('Informed', userID => {
				return this.findMember(userID).roles.exists('name', 'Informed');
			}),
		};
		this.aliases = require('../command-aliases');
		this.interactions = {
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
	}
	/**
	 * @param {string|Command} command
	 * @param {string} authorID
	 */
	commandPermCheck(command, authorID){
		const cmd = command instanceof Command ? command : this.getCommand(command);
		return this.perm[cmd.perm].check(authorID);
	}
	makeClient(){
		/**
		 * @public
		 * @type {Discord.Client}
		 */
		this.client = new Discord.Client({
			disabledEvents: [
				Discord.Constants.Events.TYPING_START,
				Discord.Constants.Events.TYPING_STOP,
			]
		});
		this.client.login(config.TOKEN).then(() => {
			this.account();
		});
	}
	account(){
		this.idle(false);
		console.info(`Using account ${this.getIdent()} (ID: ${this.client.user.id})`);

		let serverIDs = this.client.guilds.array(),
			getClientID = function(){
				if (typeof config.CLIENT_ID === 'undefined'){
					console.error('CLIENT_ID configuration option is not set, exiting');
					process.exit(1);
				}
				return config.CLIENT_ID;
			},
			getAuthURL = function(){
				return 'https://discordapp.com/oauth2/authorize?client_id='+getClientID()+'&scope=bot&permissions=0';
			};
		if (serverIDs.length === 0){
			console.error('Bot is not part of any server. To join the bot to a server, get your client ID from https://discordapp.com/developers/applications/me and place it in config.js.');

			let url = getAuthURL();
			if (config.LOCAL){
				console.error('Opening default browser to authorization URL ('+url+')');
				let browser = require('opener')(url);
				browser.unref();
				browser.stdin.unref();
				browser.stdout.unref();
				browser.stderr.unref();
			}
			else console.error('Open '+url+' in your favorite browser to continue.');
			process.exit(1);
			return;
		}

		let _theServer = this.client.guilds.get(config.SERVER_ID);

		if (typeof _theServer === 'undefined'){
			console.error('Home server not configured, listing currently joined servers:');
			console.error('');
			this.client.guilds.array().forEach(server => {
				console.error('    '+server.id+' '+'('+server.name+')');
			});
			console.error('');
			console.error('Set one of the IDs above as the SERVER_ID configuration option.');
			console.error('To join the bot to another server, visit '+getAuthURL());
			process.exit(1);
		}
		/**
		 * @type {Discord.Guild}
		 */
		this.our = _theServer;
		console.info('Found our server (Name: '+this.our.name+')');

		const staffRole = this.findRole('Staff');
		if (false === staffRole instanceof Discord.Role)
			console.warn('A role with the name of Staff must exist to enable admin-only functionality.');
		else {
			this.staffroleid = staffRole.id;
			console.info(`Found Staff role (ID: ${this.staffroleid})`);
		}

		this.hasOwner = typeof config.OWNER_ID === 'string' && config.OWNER_ID.length;
		if (!this.hasOwner)
			console.warn('Bot has no owner, functionality is limited.');
		else {
			if (!this.findUser(config.OWNER_ID)){
				this.hasOwner = false;
				console.warn('The configured owner is not among the channel members, functionality is limited.');
			}
			else {
				console.info('Owner is '+this.getIdent(config.OWNER_ID)+' (ID: '+config.OWNER_ID+')');
			}
		}
		if (!this.hasOwner)
			console.warn('You can use the /myid command to get your user ID');

		this.client.on('message', message => {
			this.onMessage(message);
		});

		this.client.on('raw', data => {
			if (data.t !== 'MESSAGE_UPDATE' || typeof data.d.author === 'undefined')
				return;

			const channel = this.findChannel(data.d.channel_id ,'id');
			const message = new Discord.Message(channel, data.d, this.client);
			this.onMessage(message);
		});

		if (this.hasOwner){
			if (config.LOCAL)
				this.client.user.setPresence({ game: { name: 'a local  version' } });
			else this.getGitData(config.OWNER_ID,config.OWNER_ID).then(data => {
				this.client.user.setPresence({ game: { name: `version ${data.hash}` } });
			}).catch(e => {
				// Ignored, because the function already logs an error to the console
			});
		}

		this.client.on('disconnect', closeEvent => {
			console.error('WebSocket disconnected', closeEvent);
			process.exit();
		});

		console.info('~ Ready ~');
	}
	isPrivateChannel(channel){
		if (typeof channel === 'string')
			channel = this.findChannel(channel);
		return channel instanceof Discord.DMChannel;
	}
	/**
	 * @param {Discord.Message} message
	 */
	onMessage(message){
		if (message.author.bot || message.system)
			return;

		if (this.isPrivateChannel(message.channel)){
			if (!this.our.members.get(message.author.id))
				return this.send(message.author, `You must be a member of the ${this.our.name} Discord server to use this bot!`);

			console.log(`Received PM from @${this.getIdent(message.author)} (${message.author.id}), contents:\n${message.content}`);
		}

		if (message.channel.name === 'welcome'){
			if (message.content.trim().indexOf('/read') === 0){
				this.handleRulesRead(message);
			}
			// If the user is Staff and the message being sent starts with /edit then we allow it through
			else if (!this.perm.isStaff.check(message.author.id) || message.content.trim().indexOf('/edit') !== 0){
				// Notify in a PM if not already informed
				if (!this.perm.informed.check(message.author.id))
					this.send(message.author, `You will not be able to chat on our server until you've read the rules in ${this.mention(this.findChannel('welcome'))}.`);
			}
			this.wipeMessage(message);
			return;
		}

		if (/^\s*[!/]\w+/.test(message))
			return this.callCommand(message);
		this.interact(message);
	}
	handleRulesRead(message){
		this.addRole(message.author, 'Informed', 'Read the rules').then(() => {
			this.send(this.findChannel('casual'), `Please welcome ${this.mention(message.author)} to our server!`);
		}).catch(() => {
			this.send(this.findChannel('staffchat'), `Failed to add Informed role to ${this.mention(message.author)}\n${this.mentionOwner()} should see what caused this in the logs.`);
		});
	}
	getIdent(authorID = this.client.user){
		let user = authorID instanceof Discord.User ? authorID : this.findUser(authorID);
		return user.username+'#'+user.discriminator;
	}
	/**
	 * @public
	 * @param {Discord.User} user
	 * @param {string} rolename
	 * @param {string} reason
	 * @return {Promise}
	 */
	addRole(user, rolename, reason){
		return this._roleAction(true, user, rolename, reason);
	}
	/**
	 * @public
	 * @param {Discord.User} user
	 * @param {string} rolename
	 * @param {string} reason
	 * @return {Promise}
	 */
	removeRole(user, rolename, reason){
		return this._roleAction(false, user, rolename, reason);
	}
	/**
	 * @private
	 * @param {boolean} isAdding
	 * @param {Discord.User} user
	 * @param {string} rolename
	 * @param {string} reason
	 * @return {Promise}
	 */
	_roleAction(isAdding, user, rolename, reason){
		return new Promise((resolve, reject) => {
			const to = isAdding ? 'to' : 'from';
			const role = this.findRole(rolename);
			if (!role){
				const add = isAdding ? 'add' : 'remove';
				console.error(`Trying to ${add} non-existing role "${rolename}" ${to} ${this.getIdent(user)}`);
				return reject();
			}
			const member = this.findMember(user.id);
			if (!member){
				console.error(`No member found with the ID ${user.id}`);
				return reject();
			}
			member.addRole(role, reason).then(resolve).catch(err => {
				const adding = isAdding ? 'adding' : 'removing';
				console.error(`Error while ${adding} "${rolename}" role ${to} ${this.getIdent(user)}`, err);
				reject(err);
			});
		});
	}
	wipeMessage(message){
		return message.delete().catch(e => {
			console.error(`Failed to delete message ${message.id}`, e);
		});
	}
	getRules(){
		return fs.readFileSync(util.root+'/assets/rules.txt', 'utf8')
			.replace(/#([a-z_-]+)/g, (_, n) => this.mention(this.findChannel(n)))
			.replace('@me',this.mention(this.client.user));
	}
	/**
	 * @param {Discord.TextBasedChannel} channel
	 * @param {string} message
	 * @param {Discord.RichEmbed} embed
	 * @return {Promise}
	 */
	send(channel, message, embed){
		if (typeof channel.send !== 'function')
			throw new Error('Server.send expects a text-based channel');
		return channel.send(message, {embed}).catch(err => {
			console.error(err);
			channel.send(`A message to this channel failed to send. ${this.mentionOwner()} should see what caused the issue in the logs.`);
		});
	}
	/**
	 * @param {Discord.Message} message
	 * @param {string} response
	 * @param {Discord.RichEmbed} embed
	 * @return {Promise}
	 */
	reply(message, response, embed){
		return this.send(message.channel, `${this.mentionUser(message.author.id)} ${response}`.trim(), embed);
	}
	idle(afk = true){
		if (typeof this.client !== 'undefined')
			this.client.user.setPresence({ afk });
	}
	getUserData(targetUser, args){
		let user,
			membership,
			userIDregex = /^<@!?(\d+)>$/;
		if (typeof targetUser !== 'string' || targetUser.trim().length === 0){
			this.reply(args.message, 'The user identifier is missing');
			return false;
		}
		if (targetUser === 'me')
			user = args.author;
		else if (/^\d+$/.test(targetUser))
			user = this.findUser(targetUser);
		else if (typeof targetUser === 'string'){
			if (userIDregex.test(targetUser))
				user = this.findUser(targetUser.replace(userIDregex,'$1'));
			else {
				user = this.findUser(targetUser, 'username');
				if (user === null){
					membership = this.findMember(targetUser, 'nickname');
					if (membership !== null)
						user = membership.user;
				}
			}
		}

		if (!(user instanceof Discord.User)){
			this.reply(args.message, `Could not find user based on the following identifier: \`${targetUser}\``);
			return false;
		}

		let data = {};
		if (typeof membership === 'undefined')
			membership = this.findMember(user.id);
		data.id = user.id;
		data.username = user.username;
		data.discriminator = user.discriminator;
		data.bot = user.bot;
		data.nick = membership.nickname;
		data.member = membership;
	
		return data;
	}
	derpiStatValue(n){
		return n === 0 ? 'None' : n;
	}
	respondWithDerpibooruImage(args, image, brief = false){
		if (!image.is_rendered)
			return this.reply(args.message, 'The requested image is not yet processed by Derpibooru, please try again in a bit');

		const tagArray = image.tags.split(', ');
		const url = `https://derpibooru.org/${image.id}`;
		const isImage = /^image\//.test(image.mime_type);
		const format = image.original_format.toUpperCase();
		const maxArtists = 8, maxDescriptionLength = 256;

		let artists = tagArray.filter(t => /^artist:/.test(t)),
			author = { name: 'Unknown Artist' };
		if (artists){
			const artistCount = artists.length;
			author.name = artists.slice(0,maxArtists).map(t => t.replace(/^artist:/,'')).join(', ');
			if (artistCount > maxArtists)
				author.name += `, \u2026 (${artistCount-maxArtists} more)`;
			author.url = artistCount > 1 ? url : `https://derpibooru.org/search?q=${encodeURIComponent(artists[0])}`;
		}

		const embed = new Discord.RichEmbed({
			title: "View image",
			url,
			color: 6393795,
			footer: { text: 'Derpibooru' },
			author,
		});
		if (!brief){
			let description = image.description;
			if (description.length > maxDescriptionLength)
				// Try trimming words that got cut in half (by removing anything that's 1-24 chars long preceeded by whiespace)
				description = description.substring(0, maxDescriptionLength).replace(/\s[\S]{1,24}$/,'') + '\u2026';
			embed.setDescription(description);

			let ratingTags = tagArray
				.filter(tag => /^(safe|suggestive|questionable|explicit|semi-grimdark|grimdark|grotesque)$/.test(tag))
				.map(tag => tag[0].toUpperCase()+tag.substring(1));

			embed.addField('Rating',      ratingTags.join(', '), true);
			embed.addField('Uploaded by', image.uploader, true);
			embed.addField('Dimensions', `${image.width} x ${image.height}`, true);
			embed.addField('Score',       image.score, true);
			embed.addField('Favorites',   this.derpiStatValue(image.faves), true);
			embed.addField('Comments',     this.derpiStatValue(image.comment_count), true);
		}
		if (isImage){
			embed.setImage(`https:${image.image}`);
		}
		else {

			embed.setThumbnail(`https://via.placeholder.com/160/E2EBF2/3D92D0?text=${format}`);
			embed.addField('Format', format, true);
			if (image.source_url)
				embed.addField('Source URL', image.source_url, true);
		}
		console.info(`Sending Derpi embed for image #${image.id}`);
		this.reply(args.message, `<${url}>`, embed);
	}
	/**
	 * @return {Promise}
	 */
	getGitData(){
		return new Promise((res, rej) => {
			const separator = ';';
			const command = shellescape(`git log -1 --date=short --pretty=format:%h${separator}%cr`.split(' '));
			exec(command, function(err, data){
				if (err){
					console.error('Error getting commit data', err);
					return rej(`Error while getting commit data\n${this.mentionOwner() ? ' may find more info in the logs' : ''}`);
				}

				const [hash, timeago] = data.trim().split(separator);
				res({ hash, timeago });
			});
		});
	}
	addErrorMessageToResponse(err, response){
		if (err)
			response += '\n(' + (this.hasOwner ? this.mention(config.OWNER_ID) + ' ' : '') + err.message + (err.response ? ': ' + err.response.message : '') + ')';
		return response;
	}
	commandExists(command){
		return fs.existsSync(util.root+`/commands/${command}.js`) || typeof this.aliases.assoc[command] !== 'undefined';
	}
	getCommand(command){
		let
			path = `${util.root}/commands/${command}.js`,
			moduleName;
		if (fs.existsSync(path))
			moduleName = path;
		else  moduleName = `${util.root}/commands/${this.aliases.assoc[command]}.js`;

		// Invalidate cached command code
		if (typeof require.cache[moduleName] !== 'undefined')
			delete require.cache[moduleName];

		return require(moduleName);
	}
	callCommand(message){
		const
			isPM = this.isPrivateChannel(message.channel),
			{ author, authorID, channel, channelID, command, argStr, argArr, silentFail } = this.processCommand(message);

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

		if (!this.commandExists(command)){
			if (silentFail){
				console.info(`Command /${command} does not exist, silently ignored`);
				return;
			}
			let notfound = `Command \`/${command}\` not found`;
			console.error(notfound);
			this.reply(channel, `${notfound}. Use \`/help\` to see a list of all available commands`);
			return;
		}

		const cmd = this.getCommand(command);
		if (false === cmd instanceof Command)
			return message.reply(`Command file \`${command}.js\` is exporting an invalid value${this.hasOwner ? '\n' + this.mentionOwner(authorID) + ' should see what caused this issue' : ''}`);
		if (typeof cmd.action !== 'function')
			return message.reply(`The specified command has no associated action`);
		if (!this.commandPermCheck(cmd, authorID))
			return message.reply(`You don't have permission to use this command`);
		if (isPM && cmd.allowPM !== true)
			return this.reply(message, util.onserver);

		cmd.action({ author, authorID, channel, channelID, message, command, argStr, argArr, isPM });
	}
	processCommand(message){
		const
			author = message.author,
			authorID = author.id,
			channel = message.channel,
			channelID = channel.id,
			messageText = message.content,
			commandRegex = /^\s*[!/](\w+)(?:\s+([ -~]+|`(?:``(?:js)\n)?[\S\s]+`(?:``)?)?)?$/,
			ranWhere = this.isPrivateChannel(message.channel) ? 'a PM' : `#${message.channel.name}`,
			silentFail = messageText[0] === '/';

		console.log(`${this.getIdent(authorID)} ran ${messageText} from ${ranWhere} (M#${message.id})`);

		if (!commandRegex.test(messageText)){
			let matchingCommand = messageText.match(/^([!/]?\S+)/);
			return message.reply('Invalid command'+(matchingCommand ? ': '+matchingCommand[1] : ''));
		}
		let commandMatch = messageText.match(commandRegex);
		if (!commandMatch)
			return;
		let
			command = commandMatch[1].toLowerCase(),
			argStr = commandMatch[2] ? commandMatch[2].trim() : '',
			argArr = argStr ? argStr.split(/\s+/) : [];

		if (command === 'join' && argStr.trim().toLowerCase() === 'nsfw'){
			command = 'nsfw';
			argStr = 'join';
			argArr = [argStr];
		}

		return { author, authorID, channel, channelID, command, argStr, argArr, silentFail };
	}
	interact(message){
		const
			userIdent = this.getIdent(message.author),
			isPM = this.isPrivateChannel(message.channel),
			messageText = message.content;
		if (isPM)
			console.log(`PM interaction initiated by ${userIdent}, message: ${messageText}`);

		let normalized = messageText.toLowerCase(),
			normalizedParts = normalized.split(/\s+/);
		normalized = normalizedParts.join(' ');

		let cgtest = /^(?:(?:is|si) t(?:he|eh)re|(?:d(?:o|id) |(?:no|nah|(?:I )?don't think so),? but )?we? (do )?ha(?:ev|ve)) a (?:(?:colou?r ?)?gui?de for (?:(?:(?:th|ht)[ew]|a|an) )?([\w\s]+)|([\w\s]+?) (?:colou?r ?)?gui?de)\??$/;
		if (cgtest.test(normalized)){
			let match = normalized.match(cgtest),
				eqgTest = /\b(human|eqg|eq(?:uestria)? girls)\b/i,
				query = (match[1]||match[2]).replace(eqgTest, '').trim(),
				eqg = eqgTest.test(normalized);

			if (!eqg && /\bsunset(?:\s?shimmer)?/.test(query))
				return this.reply(this.interactions.cgSunset.randomElement());

			unirest.get(config.SITE_ABSPATH+'cg'+(eqg?'/eqg':'')+'/1?js=true&q='+encodeURIComponent(query)+'&GOFAST=true')
				.header("Accept", "application/json")
				.end(result => {
					if (result.error || typeof result.body !== 'object'){
						console.error(result.error, result.body);
						return this.reply(message, `I could not check it right now. ${this.mentionOwner(message.author.id)} should see why in the logs.`);
					}

					let data = result.body;

					if (!data.status){
						console.error(`Color guide not found for "${query}" because: ${data.message}`);
						if (data.unavail === true)
							return;
						return this.reply(message, this.interactions.cgnotfound.randomElement());
					}

					this.reply(message, this.interactions.cgfound.randomElement()+' '+config.SITE_ABSPATH+(data.goto.substring(1)));
				});
			return;
		}

		let informedtest = /^(?:.*?\b)?(?:why(?:(?:'?s| is) there|(?: do (?:you|we) )?(even )?have) an?|what(?:'?s| is) the(?: (?:purpose|reason) (?:of|for(?: having)?|behind) the)?) ['"]?informed['"]? role\??$/i;
		if (informedtest.test(normalized)){
			this.reply(`The purpose of the Informed role is to distinguish users who've read the server rules in the ${this.mention(this.findChannel('welcome'))} channel. Once new users run the \`/read\` command mentioned in said channel, they will be given this role, which grants them access to view and chat in all other channels. Members who have already been part of the server at the time this change was introduced were given this role manually to spare them the hassle of reading the rules they were already familiar with.`);
			// noinspection UnnecessaryReturnStatementJS
			return;
		}
	}
	/**
	 * @return {Discord.Channel|null}
	 */
	findChannel(value, key = 'name'){
		return key === 'id' ? this.our.channels.get(value) : this.our.channels.find(key, value);
	}
	/**
	 * @return {boolean}
	 */
	channelExists(value, key = 'name'){
		return key === 'id' ? this.our.channels.get(value) instanceof Discord.Channel : this.our.channels.exists(key, value);
	}
	/**
	 * @return {Discord.Role|null}
	 */
	findRole(name){
		return this.our.roles.find('name', name);
	}
	/**
	 * @return {Discord.User|null}
	 */
	findUser(value, key = 'id'){
		return key === 'id' ? this.client.users.get(value) : this.client.users.find(key, value);
	}
	/**
	 * @return {Discord.GuildMember|null}
	 */
	findMember(value, key = 'id'){
		return key === 'id' ? this.our.members.get(value) : this.our.members.find(key, value);
	}
	/**
	 * @param {Discord.User|Discord.TextChannel|Discord.Role} thing
	 * @return {string}
	 */
	mention(thing){
		if (thing instanceof Discord.User)
			return this.mentionUser(thing.id);
		if (thing instanceof Discord.TextChannel)
			return this.mentionChannel(thing.id);
		if (thing instanceof Discord.Role)
			return this.mentionRole(thing.id);

		throw new Error(`Cannot mention unknown object ${thing.constructor.name}`);
	}
	/**
	 * @return {string}
	 */
	mentionUser(id){
		return `<@!${id}>`;
	}
	/**
	 * @return {string}
	 */
	mentionChannel(id){
		return `<#${id}>`;
	}
	/**
	 * @return {string}
	 */
	mentionRole(id){
		return `<@&${id}>`;
	}
	/**
	 * @return {string}
	 */
	mentionOwner(authorID){
		return (this.hasOwner ? (config.OWNER_ID === authorID ? 'You' : this.mentionUser(config.OWNER_ID)) : 'The bot owner');
	}
}

module.exports = new Server();
