const
  Command = require('../classes/Command'),
  Server = require('../classes/Server'),
  moment = require('moment');

module.exports = new Command({
  name: 'casual',
  help: () => `Politely asks everyone in the room to move to the ${Server.mention(Server.findChannel('casual'))} channel (does nothing in said channel)`,
  perm: 'everyone',
  usage: [true],
  allowPM: false,
  action: args => {
    if (args.channel.name === 'casual')
      return Server.wipeMessage(args.message);

    let possible_images = [
        'mountain', // Original by DJDavid98
        'coco',		// Coco & Rarity by Pirill
        'abcm',     // Applebloom's new CM by Drakizora
        'abfall',   // Applebloom falling by Drakizora
        'abfloat',  // CMs floating around Applebloom by Drakizora
      ],
      image_count = possible_images.length,
      k = moment().minutes() % image_count;

    Server.wipeMessage(args.message);
    Server.send(args.channel, `Please continue this discussion in ${Server.mention(Server.findChannel('casual'))}\n${process.env.SITE_ABSPATH}img/discord/casual/${possible_images[k]}.png`);
  },
});
