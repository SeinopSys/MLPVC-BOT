const
  Command = require('../classes/Command'),
  Server = require('../classes/Server');

module.exports = new Command({
  name: 'rules',
  help: () => 'List the server rules',
  perm: 'everyone',
  usage: [true],
  allowPM: true,
  action: args => {
    if (!args.isPM)
      Server.wipeMessage(args.message);

    const rulesText = `__**Server rules:**__\n\n${Server.getRules()}`;
    Server.sendSlices(args.author, rulesText);
  },
});
