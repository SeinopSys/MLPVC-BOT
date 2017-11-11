const
	moment = require('moment'),
	config = require('../config'),
	Command = require('../classes/Command'),
	Server = require('../classes/Server');

module.exports = new Command({
	name: 'casual',
	help: `Politely asks everyone in the room to move to the <#${Server.channelids.casual}> channel (does nothing in said channel)`,
	perm: 'everyone',
	usage: [true],
	action: args => {
		if (args.isPM)
			return Server.respond(args.channelID, args.onserver);

		if (args.channelID === Server.channelids.casual)
			return Server.wipeMessage(args.channelID, args.event.d.id);

		let possible_images = [
				'mountain', // Original by DJDavid98
				'coco',		// Coco & Rarity by Pirill
				'abcm',     // Applebloom's new CM by Drakizora
				'abfall',   // Applebloom falling by Drakizora
				'abfloat',  // CMs floating around Applebloom by Drakizora
			],
			image_count = possible_images.length,
			data = args.argArr[0],
			k;

		if (!isNaN(data))
			k = Math.max(0,Math.min(image_count-1,parseInt(data, 10)-1));
		else {
			k = moment().minutes() % image_count;
		}

		Server.wipeMessage(args.channelID, args.event.d.id, 'Please continue this discussion in <#'+Server.channelids.casual+'>\n'+config.SITE_ABSPATH+'img/discord/casual/'+possible_images[k]+'.png');
	},
});
