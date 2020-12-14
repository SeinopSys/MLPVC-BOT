const
  Command = require('../classes/Command'),
  Server = require('../classes/Server'),
  util = require('../shared-utils'),
  channelNames = require('../channel-names');

module.exports = new Command({
  name: 'welcome',
  help: () => `Welcomes the specified user as the bot`,
  perm: 'isStaff',
  usage: [Server.client.user.username, '@' + Server.getIdent(), Server.client.user.id],
  allowPM: true,
  action: async args => {
    if (!args.isPM)
      Server.wipeMessage(args.message);

    const user = await Server.getUserData(args.argArr[0], args);
    if (user === false)
      return;

    Server.send(Server.findChannel(channelNames.CASUAL), `Please welcome ${util.mentionUser(user.id)} to our server!`);
  }
});
