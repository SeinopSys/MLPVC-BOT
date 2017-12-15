const
	chalk = require('chalk'),
	Discord = require('discord.io'),
	fs = require('fs'),
	exec = require('child_process').exec,
	Permission = require('./Permission'),
	util = require('../shared-utils'),
	config = require('../config');

class Server {
	constructor(){
		this.perm = {
			isOwner: new Permission('Bot Developer', userID => {
				return userID === config.OWNER_ID;
			}),
			isStaff: new Permission('Staff', userID => {
				return this.our.members[userID].roles.indexOf(this.staffroleid) !== -1;
			}),
			isMember: new Permission('Club Members', userID => {
				return this.our.members[userID].roles.indexOf(this.roleids['Club Members']) !== -1;
			}),
			everyone: new Permission('Everyone',function(){ return true }),
			nonmembers: new Permission('Non-members', userID => {
				return !this.perm.isStaff.check(userID) && !this.perm.isMember.check(userID);
			}),
			informed: new Permission('Informed', userID => {
				return this.our.members[userID].roles.indexOf(this.roleids.Informed) !== -1;
			}),
		};
		this.channelids = {};
		this.roleids = {};
		this.staffroleid = void 0;
		this.aliases = require('../command-aliases');
	}
	commandPermCheck(command, userID){
		return this.perm[this.getCommand(command).perm].check(userID);
	}
	makeBot(){
		this.bot = new Discord.Client({
			autorun: true,
			token: config.TOKEN,
		});
	}
	account(){
		this.bot.setPresence({ idle_since: null });
		console.log('Using account '+this.getIdent(this.bot.id)+' (ID: '+this.bot.id+')');

		this.bot.on('channelCreate', channel => {
			this.channelids[channel.name] = channel.id;
			this.bot.channels[channel.id] = channel;
		});
		this.bot.on('channelUpdate', (oldChannel, newChannel) => {
			if (oldChannel.name !== newChannel.name){
				delete this.channelids[oldChannel.name];
				this.channelids[newChannel.name] = newChannel.id;
			}
			this.bot.channels[oldChannel.id] = newChannel;
		});
		this.bot.on('channelDelete', channel => {
			delete this.channelids[channel.name];
			delete this.bot.channels[channel.id];
		});
		this.bot.on('guildMemberAdd', member => {
			this.bot.users[member.id] = member.user;
			delete member.user;
			this.our.members[member.id] = member;

			console.log('New guild member detected: '+this.bot.users[member.id].name);
		});

		let serverIDs = Object.keys(this.bot.servers),
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
			console.log('Bot is not part of any this. To join the bot to a server, get your client ID from https://discordapp.com/developers/applications/me and place it in config.js.');

			let openAuthPage = function(){
				let url = getAuthURL();
				if (config.LOCAL){
					console.log('Opening default browser to authorization URL ('+url+')');
					let browser = require('opener')(url);
					browser.unref();
					browser.stdin.unref();
					browser.stdout.unref();
					browser.stderr.unref();
				}
				else console.log('Open '+url+' in your favorite browser to continue.');
				process.exit(1);
			};

			openAuthPage();
			return;
		}

		let _theServer = this.bot.servers[config.SERVER_ID];
		if (typeof _theServer === 'undefined'){
			console.log('Could not find our server, listing currently joined servers:\n');
			for (let i=0; i<serverIDs.length; i++){
				let id = serverIDs[i];
				console.log('    '+id+' '+'('+this.bot.servers[id].name+')');
			}
			console.log('\nSet one of the IDs above as the SERVER_ID configuration option.\nTo join the bot to another server, visit '+getAuthURL());
			process.exit(1);
		}
		this.our = _theServer;
		console.log('Found our server (Name: '+this.our.name+')');

		for (let i in this.our.roles){
			if (!this.our.roles.hasOwnProperty(i))
				continue;

			let role = this.our.roles[i];
			this.roleids[role.name] = role.id;
			if (typeof this.staffroleid === 'undefined' && role.name === 'Staff')
				this.staffroleid = role.id;
		}
		if (typeof this.staffroleid === 'undefined')
			console.log(chalk.red('A role with the name of Staff must exist to enable admin-only functionality.'));
		else console.log(`Found Staff role (ID: ${this.staffroleid})`);
		for (let i in this.our.channels){
			if (!this.our.channels.hasOwnProperty(i))
				continue;

			let channel = this.our.channels[i];
			this.channelids[channel.name] = channel.id;
		}

		this.hasOwner = typeof config.OWNER_ID === 'string' && config.OWNER_ID.length;
		const limitedFunc = ', functionality is limited.\nUse the /myid command to get your user ID';
		if (!this.hasOwner)
			console.log('Bot has no owner'+limitedFunc);
		else {
			if (!(config.OWNER_ID in this.bot.users)){
				this.hasOwner = false;
				console.log('The configured owner is not among the channel members'+limitedFunc);
			}
			else {
				console.log('Owner is '+this.getIdent(config.OWNER_ID)+' (ID: '+config.OWNER_ID+')');
			}
		}

		console.log(chalk.green('Ready\n'));
	}
	getIdent(userID){
		let user = this.bot.users[userID];
		return user.username+'#'+user.discriminator;
	}
	addRole(userID, rolename){
		if (typeof this.roleids[rolename] === 'undefined')
			console.log('Trying to add non-existing role "'+rolename+'" to '+this.getIdent(userID));
		return new Promise((fulfill, reject) => {
			this.bot.addToRole({
				serverID: this.our.id,
				userID: userID,
				roleID: this.roleids[rolename],
			}, err => {
				if (err){
					console.log('Error while adding '+rolename+' role to '+this.getIdent(userID));
					console.log(err);
					reject(err);
					return;
				}

				this.our.members[userID].roles.push(this.roleids[rolename]);
				fulfill();
			});
		});
	}
	removeRole(userID, rolename){
		if (typeof this.roleids[rolename] === 'undefined')
			console.log('Trying to remove non-existing role "'+rolename+'" from '+this.getIdent(userID));
		return new Promise((fulfill, reject) => {
			this.bot.removeFromRole({
				serverID: this.our.id,
				userID: userID,
				roleID: this.roleids[rolename],
			}, err => {
				if (err){
					console.log('Error while adding '+rolename+' role to '+this.getIdent(userID));
					console.log(err);
					reject(err);
					return;
				}

				const roleix = this.our.members[userID].roles.indexOf(this.roleids['Pony Sauce']);
				if (roleix !== -1)
					this.our.members[userID].roles.splice(roleix, 1);
				fulfill();
			});
		});
	}
	mentionOwner(userID){
		return (this.hasOwner ? (config.OWNER_ID === userID ? 'You' : `<@${config.OWNER_ID}>`) : 'The bot owner');
	}
	wipeMessage(channelID, messageID, response, userID){
		this.bot.deleteMessage({
			channelID: channelID,
			messageID: messageID,
		}, err => {
			let callback = msg => {
				if (!msg)
					return;
				this.respond(channelID, userID ? util.replyTo(userID, msg) : msg);
			};
			if (typeof response === 'function'){
				callback = response;
				response = '';
			}
			response = this.addErrorMessageToResponse(err, response);
			callback(response, Boolean(err));
		});
	}
	getRules(){
		return fs.readFileSync(util.root+'/assets/rules.txt', 'utf8').replace(/#([a-z_-]+)/g,(_,n)=>'<#'+this.channelids[n]+'>').replace('@me',`<@${this.bot.id}>`);
	}
	respond(channelID, message, callback){
		return this.bot.sendMessage({
			to: channelID,
			message: message,
		}, (err, ...etc) => {
			if (typeof callback === 'function'){
				callback(err, ...etc);
				return;
			}
			if (err){
				console.log(err);
				this.bot.sendMessage({
					to: channelID,
					message: 'A message to this channel failed to send. (HTTP '+err.statusCode+')\n'+this.mentionOwner()+'should see what caused the issue in the logs.',
				});
			}
		});
	}
	idle(){
		if (typeof this.bot !== 'undefined')
			this.bot.setPresence({ idle_since: Date.now() });
	}
	getUserData(targetUser, args){
		let member,
			i,
			userIDregex = /^<@!?(\d+)>$/;
		if (typeof targetUser !== 'string' || targetUser.trim().length === 0){
			this.respond(args.channelID, util.replyToIfNotPM(args.isPM, args.userID, 'The user identifier is missing'));
			return false;
		}
		if (targetUser === 'me')
			member = this.bot.users[args.userID];
		else {
			if (typeof targetUser !== 'string' || !userIDregex.test(targetUser)){
				for (i in this.bot.users){
					if (!this.bot.users.hasOwnProperty(i))
						continue;
	
					if (this.bot.users[i].username.toLowerCase() === targetUser.toLowerCase()){
						member = this.bot.users[i];
						break;
					}
				}
				if (typeof member === 'undefined')
					for (i in this.our.members){
						if (!this.our.members.hasOwnProperty(i))
							continue;
						if (typeof this.our.members[i].nick === 'undefined')
							continue;
	
						if (this.our.members[i].nick.toLowerCase().indexOf(targetUser.toLowerCase()) === 0){
							member = this.our.members[i];
							break;
						}
					}
				if (typeof member === 'undefined'){
					this.respond(args.channelID, util.replyToIfNotPM(args.isPM, args.userID, 'The user identifier is missing or invalid (`'+targetUser+'`)'));
					return false;
				}
			}
			else member = this.bot.users[targetUser.replace(userIDregex,'$1')];
		}
		let data = {},
			membership = this.our.members[member.id];
		data.id = member.id;
		data.username = member.username;
		data.discriminator = member.discriminator;
		data.nick = membership.nick;
		data.roles = [];
		for (i in membership.roles){
			if (!membership.roles.hasOwnProperty(i))
				continue;
	
			data.roles.push(this.our.roles[membership.roles[i]].name);
		}
	
		return data;
	}
	respondWithDerpibooruImage(args, image){
		if (!image.is_rendered)
			return this.respond(args.channelID, util.replyTo(args.userID, 'The requested image is not yet processed by Derpibooru, please try again in a bit'));

		this.respond(args.channelID, util.replyTo(args.userID, 'https://derpibooru.org/' + image.id));
	}
	getVersion(channelID, userID, callback){
		const separator = '$';
		exec(`git log -1 --date=short --pretty=format:%h${separator}%cr`, function(err, data){
			let m, privateMsg = userID === channelID;
			if (err){
				console.log('Error getting commit data', err);
				m = 'Error while getting commit data' + (this.hasOwner ? ' (<@' + config.OWNER_ID + '> Logs may contain more info)' : '');
				return this.respond(channelID, !privateMsg ? util.replyTo(userID, m) : m);
			}

			callback.apply(null, data.trim().split(separator));
		});
	}
	addErrorMessageToResponse(err, response){
		if (err)
			response += '\n(' + (this.hasOwner ? '<@' + config.OWNER_ID + '> ' : '') + err.message + (err.response ? ': ' + err.response.message : '') + ')';
		return response;
	}
	commandExists(command){
		return fs.existsSync(util.root+`/commands/${command}.js`) || typeof this.aliases.assoc[command] !== 'undefined';
	}
	getCommand(command){
		let path = util.root+`/commands/${command}`;

		return require(fs.existsSync(path+'.js') ? path : util.root+`/commands/${this.aliases.assoc[command]}`);
	}
}

module.exports = new Server();
