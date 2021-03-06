const
  Command = require('../classes/Command'),
  Server = require('../classes/Server');

module.exports = new Command({
  name: 'rekt',
  help: () => 'Apply cold water to the burned area',
  perm: 'everyone',
  usage: [true],
  allowPM: true,
  action: args => {
    Server.reply(args.message, '**REKT** https://www.youtube.com/watch?v=tfyqk26MqdE');
  },
});
