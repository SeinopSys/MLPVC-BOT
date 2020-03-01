const
  unirest = require('unirest'),
  Command = require('../classes/Command'),
  Server = require('../classes/Server');

module.exports = new Command({
  name: 'lewder',
  help: () => 'Signal that the conversation is not lewd enough.',
  perm: 'everyone',
  usage: [true],
  allowPM: true,
  action: args => {
    unirest.get('https://derpibooru.org/api/v1/json/images/1308747')
      .header("Accept", "application/json")
      .end(function (result) {
        if (result.error || typeof result.body !== 'object' || typeof result.body.image !== 'object') {
          console.error(result.error, result.body);
          return Server.reply(args.message, `Derpibooru image data retrieval failed (HTTP ${result.status}). ${Server.mentionOwner(args.authorID)} should see what caused the issue in the logs.`);
        }

        Server.respondWithDerpibooruImage(args, result.body.image, true);
      });
  },
});
