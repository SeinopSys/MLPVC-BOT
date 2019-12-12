const
  Command = require('../classes/Command'),
  Server = require('../classes/Server');

module.exports = new Command({
  name: 'yes',
  help: () => 'Yes',
  perm: 'everyone',
  usage: [true],
  action: args => {
    Server.reply(args.message, 'https://www.youtube.com/watch?v=P3ALwKeSEYs');
  }
});
