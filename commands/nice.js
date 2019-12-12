const
  Command = require('../classes/Command'),
  Server = require('../classes/Server');

module.exports = new Command({
  name: 'nice',
  help: () => 'Nice',
  perm: 'everyone',
  usage: [true],
  allowPM: true,
  action: args => {
    Server.reply(args.message, 'https://youtube.com/watch?v=ffQmb-cNFuk');
  }
});
