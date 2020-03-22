const
  Discord = require('discord.js'),
  fs = require('fs'),
  exec = require('child_process').exec,
  Permission = require('./Permission'),
  util = require('../shared-utils'),
  Command = require('./Command'),
  unirest = require('unirest'),
  shellescape = require('shell-escape'),
  sample = require('lodash/sample');

class Server {
  constructor() {
    this.perm = {
      isOwner: new Permission('Bot Developer', userID => {
        return Promise.resolve(userID === process.env.BOT_OWNER_ID);
      }),
      isStaff: new Permission('Staff', async userID => {
        const member = await this.findMember(userID);
        return member.roles.cache.some(el => el.id === this.staffroleid);
      }),
      isMember: new Permission('Club Members', async userID => {
        const member = await this.findMember(userID);
        return member.roles.cache.some(el => el.name === 'Club Members');
      }),
      everyone: new Permission('Everyone', function () {
        return true
      }),
      nonmembers: new Permission('Non-members', async userID => {
        const isStaff = await this.perm.isStaff.check(userID);
        const isMember = await this.perm.isMember.check(userID);
        return !isStaff && !isMember;
      }),
      informed: new Permission('Informed', async userID => {
        const member = await this.findMember(userID);
        return member.roles.cache.some(el => el.name === 'Informed');
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
      ]
    };
  }

  /**
   * @param {string|Command} command
   * @param {string} authorID
   */
  commandPermCheck(command, authorID) {
    const cmd = command instanceof Command ? command : this.getCommand(command);
    if (typeof this.perm[cmd.perm] === 'undefined')
      throw new Error(`Permission function ${cmd.perm} not found`);
    return this.perm[cmd.perm].check(authorID);
  }

  makeClient() {
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
    this.client.login(process.env.DISCORD_BOT_TOKEN);
    this.client.on('ready', () => {
      this.account();
    });
  }

  account() {
    this.idle(false);
    console.info(`Using account ${this.getIdent()} (ID: ${this.client.user.id})`);

    let serverIDs = this.client.guilds.cache.array(),
      getClientID = function () {
        if (typeof process.env.DISCORD_CLIENT_ID === 'undefined') {
          console.error('DISCORD_CLIENT_ID configuration option is not set, exiting');
          process.exit(1);
        }
        return process.env.DISCORD_CLIENT_ID;
      },
      getAuthURL = function () {
        return 'https://discordapp.com/oauth2/authorize?client_id=' + getClientID() + '&scope=bot&permissions=0';
      };
    if (serverIDs.length === 0) {
      console.error('Bot is not part of any server. To join the bot to a server, get your client ID from https://discordapp.com/developers/applications/me and place it in .env');

      let url = getAuthURL();
      if (process.env.LOCAL === 'true') {
        console.error('Opening default browser to authorization URL (' + url + ')');
        let browser = require('opener')(url);
        browser.unref();
        browser.stdin.unref();
        browser.stdout.unref();
        browser.stderr.unref();
      } else console.error('Open ' + url + ' in your favorite browser to continue.');
      process.exit(1);
      return;
    }

    let _theServer = this.client.guilds.cache.get(process.env.SERVER_ID);

    if (typeof _theServer === 'undefined') {
      console.error('Home server not configured, listing currently joined servers:');
      console.error('');
      this.client.guilds.array().forEach(server => {
        console.error('    ' + server.id + ' ' + '(' + server.name + ')');
      });
      console.error('');
      console.error('Set one of the IDs above as the SERVER_ID configuration option.');
      console.error('To join the bot to another server, visit ' + getAuthURL());
      process.exit(1);
    }
    /**
     * @type {Discord.Guild}
     */
    this.guild = _theServer;
    console.info('Found our server (Name: ' + this.guild.name + ')');

    const staffRole = this.findRole('Staff');
    if (!(staffRole instanceof Discord.Role))
      console.warn('A role with the name of Staff must exist to enable admin-only functionality.');
    else {
      this.staffroleid = staffRole.id;
      console.info(`Found Staff role (ID: ${this.staffroleid})`);
    }

    this.hasOwner = typeof process.env.BOT_OWNER_ID === 'string' && process.env.BOT_OWNER_ID.length;
    if (!this.hasOwner)
      console.warn('Bot has no owner, functionality is limited.');
    else {
      if (!this.findUser(process.env.BOT_OWNER_ID)) {
        this.hasOwner = false;
        console.warn('The configured owner is not among the channel members, functionality is limited.');
      } else {
        console.info(`Owner is ${this.getIdent(process.env.BOT_OWNER_ID)} (ID: ${process.env.BOT_OWNER_ID})`);
      }
    }
    if (!this.hasOwner)
      console.warn('You can use the /myid command to get your user ID');

    this.client.on('message', message => {
      this.onMessage(message);
    });

    this.client.on('messageUpdate', (_, message) => {
      this.onMessage(message);
    });

    if (this.hasOwner) {
      if (process.env.LOCAL === 'true')
        this.client.user.setPresence({activity: {name: 'a local  version'}});
      else this.getGitData(process.env.BOT_OWNER_ID, process.env.BOT_OWNER_ID).then(data => {
        this.client.user.setPresence({activity: {name: `version ${data.hash}`}});
      }).catch(() => {
        // Ignored, because the function already logs an error to the console
      });
    }

    this.client.on('disconnect', closeEvent => {
      console.error('WebSocket disconnected', closeEvent);
      process.exit();
    });

    this.client.on('guildMemberAdd', member => this.updateWebsiteUserLink(member));
    this.client.on('guildMemberRemove', member => this.updateWebsiteUserLink(member));
    this.client.on('guildMemberUpdate', member => this.updateWebsiteUserLink(member));
    this.client.on('userUpdate', async user => {
      if (user.bot)
        return;

      const member = await this.findMember(user.id);
      if (member !== null)
        this.updateWebsiteUserLink(member);
    });

    console.info('~ Ready ~');
  }

  updateWebsiteUserLink(member) {
    if (member.guild.id !== this.guild.id)
      return;
    const userId = member.id;
    unirest.post(`${process.env.SITE_ABSPATH}discord-connect/bot-update/${userId}`)
      .header("Accept", "application/json")
      .send({key: process.env.WS_SERVER_KEY})
      .end(result => {
        let owner;
        const message = `Updating linked user on the site failed for ID ${userId}`;
        if (this.hasOwner)
          owner = this.findUser(process.env.BOT_OWNER_ID);
        if (result.error || typeof result.body !== 'object') {
          console.error(result.error, result.body);
          if (this.hasOwner)
            this.send(owner, `${message} (HTTP ${result.status})`);
          return;
        }

        let data = result.body;
        if (data.status)
          return;

        this.send(owner, `${message}: ${data.message}`);
      });
  }

  isPrivateChannel(channel) {
    if (typeof channel === 'string')
      channel = this.findChannel(channel);
    return channel instanceof Discord.DMChannel;
  }

  /**
   * @param {Discord.Message} message
   */
  async onMessage(message) {
    if (message.author.bot || message.system)
      return;

    if (this.isPrivateChannel(message.channel)) {
      if (!this.guild.members.get(message.author.id))
        return this.send(message.author, `You must be a member of the ${this.guild.name} Discord server to use this bot!`);

      console.log(`Received PM from @${this.getIdent(message.author)} (${message.author.id}), contents:\n${message.content}`);
    }

    if (message.channel.name === 'welcome') {
      if (message.content.trim().indexOf('/read') === 0) {
        this.handleRulesRead(message);
      }
      // If the user is Staff and the message being sent starts with /edit then we allow it through
      else if (!(await this.perm.isStaff.check(message.author.id)) || message.content.trim().indexOf('/edit') !== 0) {
        // Notify in a PM if not already informed
        if (!(await this.perm.informed.check(message.author.id)))
          this.send(message.author, `You will not be able to chat on our server until you've read the rules in ${this.mention(this.findChannel('welcome'))}.`);
      }
      this.wipeMessage(message);
      return;
    }

    if (/^\s*[!/]\w+/.test(message))
      return this.callCommand(message);
    this.interact(message);
  }

  handleRulesRead(message) {
    this.addRole(message.author, 'Informed', 'Read the rules').then(() => {
      this.send(this.findChannel('casual'), `Please welcome ${this.mention(message.author)} to our server!`);
    }).catch(() => {
      this.send(this.findChannel('staffchat'), `Failed to add Informed role to ${this.mention(message.author)}\n${this.mentionOwner()} should see what caused this in the logs.`);
    });
  }

  getIdent(authorID = this.client.user) {
    let user = authorID instanceof Discord.User ? authorID : this.findUser(authorID);
    return user.username + '#' + user.discriminator;
  }

  /**
   * @public
   * @param {Discord.User} user
   * @param {string} rolename
   * @param {string} reason
   * @return {Promise}
   */
  addRole(user, rolename, reason) {
    return this._roleAction(true, user, rolename, reason);
  }

  /**
   * @public
   * @param {Discord.User} user
   * @param {string} rolename
   * @param {string} reason
   * @return {Promise}
   */
  removeRole(user, rolename, reason) {
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
  _roleAction(isAdding, user, rolename, reason) {
    return new Promise((resolve, reject) => {
      const to = isAdding ? 'to' : 'from';
      const role = this.findRole(rolename);
      const action = isAdding ? 'add' : 'remove';
      if (!role) {
        const add = isAdding ? 'add' : 'remove';
        console.error(`Trying to ${add} non-existing role "${rolename}" ${to} ${this.getIdent(user)}`);
        return reject();
      }
      this.findMember(user.id).then(member => {
        if (!member) {
          console.error(`No member found with the ID ${user.id}`);
          return reject();
        }
        member.roles[action](role, reason).then(resolve).catch(err => {
          const adding = isAdding ? 'adding' : 'removing';
          console.error(`Error while ${adding} "${rolename}" role ${to} ${this.getIdent(user)}`, err);
          reject(err);
        });
      });
    });
  }

  wipeMessage(message) {
    return message.delete().catch(e => {
      console.error(`Failed to delete message ${message.id}`, e);
    });
  }

  getRules() {
    return fs.readFileSync(util.root + '/assets/rules.txt', 'utf8')
      .replace(/#([a-z_-]+)/g, (_, n) => this.mention(this.findChannel(n)))
      .replace('@me', this.mention(this.client.user));
  }

  /**
   * @param {Discord.TextBasedChannel} channel
   * @param {string} message
   * @param {Discord.MessageEmbed} embed
   * @return {Promise}
   */
  send(channel, message, embed) {
    if (typeof channel.send !== 'function') {
      console.error('Could not send message:', message);
      throw new Error('Server.send expects a text-based channel');
    }
    return channel.send(message, {embed}).catch(err => {
      console.error(err);
      channel.send(`A message to this channel failed to send. ${this.mentionOwner()} should see what caused the issue in the logs.`);
    });
  }

  /**
   * @param {Discord.TextBasedChannel} channel
   * @param {string[]} message
   * @return {Promise}
   */
  async sendSlices(channel, message) {
    const messageSlices = message.split(/-----/g);
    while (messageSlices.length) {
      await this.send(channel, messageSlices.splice(0, 1)[0]);
    }
  }

  /**
   * @param {Discord.Message} message
   * @param {string} response
   * @param {Discord.MessageEmbed} embed
   * @return {Promise}
   */
  reply(message, response, embed) {
    return this.send(message.channel, `${util.mentionUser(message.author.id)} ${response}`.trim(), embed);
  }

  idle(afk = true) {
    if (typeof this.client !== 'undefined')
      this.client.user.setPresence({afk});
  }

  async getUserData(targetUser, args) {
    let user,
      membership,
      userIDregex = /^<@!?(\d+)>$/,
      targetUserIsString = typeof targetUser === 'string';
    if (!targetUserIsString || targetUser.trim().length === 0) {
      this.reply(args.message, 'The user identifier is missing');
      return false;
    }
    if (targetUser === 'me')
      user = args.author;
    else if (/^\d+$/.test(targetUser))
      user = this.findUser(targetUser);
    else if (userIDregex.test(targetUser))
      user = this.findUser(targetUser.replace(userIDregex, '$1'));
    else {
      user = this.findUser(targetUser, 'username');
      if (user === null) {
        membership = await this.findMember(targetUser, 'nickname');
        if (membership === null) {
          this.reply(args.message, `Could not find server member based on the following nickname: \`${targetUser}\``);
          return false;
        }
        user = membership.user;
      }
    }

    if (!(user instanceof Discord.User)) {
      this.reply(args.message, `Could not find user based on the following identifier: \`${targetUser}\``);
      return false;
    }

    let data = {};
    if (typeof membership === 'undefined')
      membership = await this.findMember(user.id);
    data.id = user.id;
    data.username = user.username;
    data.discriminator = user.discriminator;
    data.bot = user.bot;
    data.nick = membership.nickname;
    data.member = membership;

    return data;
  }

  derpiStatValue(n) {
    return n === 0 ? 'None' : n;
  }

  respondWithDerpibooruImage(args, image, brief = false) {
    if (!image.processed)
      return this.reply(args.message, 'The requested image is not yet processed by Derpibooru, please try again in a bit');

    const tagArray = image.tags;
    const url = `https://derpibooru.org/${image.id}`;
    const isImage = /^image\//.test(image.mime_type);
    const format = image.format.toUpperCase();
    const maxArtists = 8, maxDescriptionLength = 256;

    let artists = tagArray.filter(t => /^artist:/.test(t)),
      author = {name: 'Unknown Artist'};
    if (artists) {
      const artistCount = artists.length;
      author.name = artists.slice(0, maxArtists).map(t => t.replace(/^artist:/, '')).join(', ');
      if (artistCount > maxArtists)
        author.name += `, \u2026 (${artistCount - maxArtists} more)`;
      author.url = artistCount > 1 ? url : `https://derpibooru.org/api/v1/json/search/images?q=${encodeURIComponent(artists[0])}`;
    }

    const embed = new Discord.MessageEmbed({
      title: "View image",
      url,
      color: 6393795,
      footer: {text: 'Derpibooru'},
      author,
    });
    if (!brief) {
      let description = image.description;
      if (description.length > maxDescriptionLength)
        // Try trimming words that got cut in half (by removing anything that's 1-24 chars long preceeded by whiespace)
        description = description.substring(0, maxDescriptionLength).replace(/\s[\S]{1,24}$/, '') + '\u2026';
      embed.setDescription(description);

      let ratingTags = tagArray
        .filter(tag => /^(safe|suggestive|questionable|explicit|semi-grimdark|grimdark|grotesque)$/.test(tag))
        .map(tag => tag[0].toUpperCase() + tag.substring(1));

      embed.addField('Rating', ratingTags.join(', '), true);
      embed.addField('Uploaded by', image.uploader, true);
      embed.addField('Dimensions', `${image.width} x ${image.height}`, true);
      embed.addField('Score', image.score, true);
      embed.addField('Favorites', this.derpiStatValue(image.faves), true);
      embed.addField('Comments', this.derpiStatValue(image.comment_count), true);
    }
    if (isImage) {
      embed.setImage(image.view_url);
    } else {

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
  getGitData() {
    return new Promise((res, rej) => {
      const separator = ';';
      const command = shellescape(`env -i git log -1 --date=short --pretty=format:%h${separator}%cr`.split(' '));
      exec(command, {cwd: util.root}, (err, data) => {
        if (err) {
          console.error('Error getting commit data', err);
          return rej(`Error while getting commit data\n${this.mentionOwner() ? ' may find more info in the logs' : ''}`);
        }

        const [hash, timeago] = data.trim().split(separator);
        res({hash, timeago});
      });
    });
  }

  addErrorMessageToResponse(err, response) {
    if (err)
      response += '\n(' + (this.hasOwner ? util.mentionUser(process.env.BOT_OWNER_ID) + ' ' : '') + err.message + (err.response ? ': ' + err.response.message : '') + ')';
    return response;
  }

  commandExists(command) {
    return fs.existsSync(`${util.root}/commands/${command}.js`) || typeof this.aliases.assoc[command] !== 'undefined';
  }

  getCommand(command) {
    let moduleName;
    try {
      moduleName = require.resolve(`${util.root}/commands/${command}`);
    } catch (e) {
      try {
        moduleName = require.resolve(`${util.root}/commands/${this.aliases.assoc[command]}`);
      } catch (e) { /* ignore */
      }
    }

    // Invalidate cached command code
    if (moduleName && typeof require.cache[moduleName] !== 'undefined')
      delete require.cache[moduleName];

    return require(moduleName);
  }

  async callCommand(message) {
    const
      isPM = this.isPrivateChannel(message.channel),
      processed = this.processCommand(message);

    if (!processed)
      return;

    const {author, authorID, channel, channelID, command, argStr, argArr, silentFail} = processed;

    switch (command) {
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
      case "say":
        return;
    }

    if (!this.commandExists(command)) {
      if (silentFail) {
        console.info(`Command /${command} does not exist, silently ignored`);
        return;
      }
      let notfound = `Command \`/${command}\` not found`;
      console.error(notfound);
      this.reply(channel, `${notfound}. Use \`/help\` to see a list of all available commands`);
      return;
    }

    const cmd = this.getCommand(command);
    if (!(cmd instanceof Command))
      return message.reply(`Command file \`${command}.js\` is exporting an invalid value${this.hasOwner ? '\n' + this.mentionOwner(authorID) + ' should see what caused this issue' : ''}`);
    if (typeof cmd.action !== 'function')
      return message.reply(`The specified command has no associated action`);
    const hasPerm = await this.commandPermCheck(cmd, authorID);
    if (!hasPerm)
      return message.reply(`You don't have permission to use this command`);
    if (isPM && cmd.allowPM !== true)
      return this.reply(message, util.onserver);

    cmd.action({author, authorID, channel, channelID, message, command, argStr, argArr, isPM});
  }

  processCommand(message) {
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

    if (!commandRegex.test(messageText)) {
      const matchingCommand = messageText.match(/^([!/]?\S+)/);
      const text = 'Invalid command' + (matchingCommand ? ': ' + matchingCommand[1] : '');
      if (!silentFail)
        message.reply(text);
      else console.error(text);
      return;
    }
    let commandMatch = messageText.match(commandRegex);
    if (!commandMatch)
      return;
    let
      command = commandMatch[1].toLowerCase(),
      argStr = commandMatch[2] ? commandMatch[2].trim() : '',
      argArr = argStr ? argStr.split(/\s+/) : [];

    return {author, authorID, channel, channelID, command, argStr, argArr, silentFail};
  }

  interact(message) {
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
    if (cgtest.test(normalized)) {
      let match = normalized.match(cgtest),
        eqgTest = /\b(human|eqg|eq(?:uestria)? girls)\b/i,
        query = (match[1] || match[2]).replace(eqgTest, '').trim(),
        eqg = eqgTest.test(normalized);

      unirest.get(`${process.env.SITE_ABSPATH}api/private/cg/appearances?q=${encodeURIComponent(query)}&EQG=${eqg ? 'true' : 'false'}`)
        .header("Accept", "application/json")
        .end(result => {
          if (result.error || typeof result.body !== 'object') {
            console.error(result.error, result.body);
            return this.reply(message, `I could not check it right now. ${this.mentionOwner(message.author.id)} should see why in the logs.`);
          }

          let data = result.body;

          if (data.status === false || data.length < 1) {
            console.error(`Color guide not found for "${query}" because: ${data.message || JSON.stringify(data)}`);
            return this.reply(message, sample(this.interactions.cgnotfound));
          }

          this.reply(message, sample(this.interactions.cgfound) + ' ' + process.env.SITE_ABSPATH + (data[0].url.substring(1)));
        });
      return;
    }

    let informedtest = /^(?:.*?\b)?(?:why(?:(?:'?s| is) there|(?: do (?:you|we) )?(even )?have) an?|what(?:'?s| is) the(?: (?:purpose|reason) (?:of|for(?: having)?|behind) the)?) ['"]?informed['"]? role\??$/i;
    if (informedtest.test(normalized)) {
      this.reply(`The purpose of the Informed role is to distinguish users who've read the server rules in the ${this.mention(this.findChannel('welcome'))} channel. Once new users run the \`/read\` command mentioned in said channel, they will be given this role, which grants them access to view and chat in all other channels. Members who have already been part of the server at the time this change was introduced were given this role manually to spare them the hassle of reading the rules they were already familiar with.`);
      // noinspection UnnecessaryReturnStatementJS
      return;
    }
  }

  /**
   * @return {Discord.Channel|null}
   */
  findChannel(value, key = 'name') {
    const channel = key === 'id' ? this.guild.channels.cache.get(value) : this.guild.channels.cache.find(x => x[key] === value);
    if (!channel)
      throw new Error(`Could not find channel matching {${key}: ${value}}`);
    return channel;
  }

  /**
   * @return {boolean}
   */
  channelExists(value, key = 'name') {
    return key === 'id' ? this.guild.channels.cache.get(value) instanceof Discord.Channel : this.guild.channels.cache.some(el => el[key] === value);
  }

  /**
   * @return {Discord.Role|null}
   */
  findRole(name) {
    return this.guild.roles.cache.find(x => x.name === name);
  }

  /**
   * @return {Discord.User|null}
   */
  findUser(value, key = 'id') {
    return key === 'id' ? this.client.users.cache.get(value) : this.client.users.cache.find(x => x[key] === value);
  }

  /**
   * @return {Discord.GuildMember|null}
   */
  async findMember(value, key = 'id') {
    if (key === 'id') {
      let member = this.guild.members.cache.get(value);
      if (typeof member === 'undefined')
        member = await this.guild.members.fetch(value);
      return member;
    }
    return this.guild.members.cache.find(x => x[key] === value);
  }

  /**
   * @param {Discord.User|Discord.TextChannel|Discord.Role} thing
   * @return {string}
   */
  mention(thing) {
    if (!thing)
      throw new Error(`Cannot mention thing of type ${typeof thing}`);

    if (thing instanceof Discord.User)
      return util.mentionUser(thing.id);
    if (thing instanceof Discord.TextChannel)
      return util.mentionChannel(thing.id);
    if (thing instanceof Discord.Role)
      return util.mentionRole(thing.id);

    throw new Error(`Cannot mention unknown object ${thing.constructor.name}`);
  }

  /**
   * @return {string}
   */
  mentionOwner(authorID) {
    return (this.hasOwner ? (process.env.BOT_OWNER_ID === authorID ? 'You' : util.mentionUser(process.env.BOT_OWNER_ID)) : 'The bot owner');
  }
}

module.exports = new Server();
