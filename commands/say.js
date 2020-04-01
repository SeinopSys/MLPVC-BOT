const
  Command = require('../classes/Command'),
  Server = require('../classes/Server');

module.exports = new Command({
  name: 'say',
  help: () => `Send a message to the specified channel as the bot.`,
  perm: 'isStaff',
  usage: ["#casual What nice weather we're having"],
  allowPM: true,
  action: async args => {
    if (!args.isPM)
      Server.wipeMessage(args.message);

    if (args.argArr.length < 2)
      return Server.reply(args.message, 'This command requires at least 2 arguments, see `/help ' + args.command + '`');

    const channelIdRegex = /^<#(\d+)>\s*$/;
    const channelIdMatch = args.argArr[0].match(channelIdRegex);
    if (channelIdMatch === null)
      return Server.reply(args.message, `Channel ID not found or invalid`);

    const channelId = channelIdMatch[1];
    const channel = await Server.findChannel(channelId, 'id');
    if (channel === false)
      return Server.reply(args.message, `Cannot find channel by ID ${channelId}`);

    Server.send(channel, args.argStr.replace(/^<#\d+>\s*/, ''));
  }
});
