const
  unirest = require('unirest'),
  nth = require('nth'),
  Time = require('../classes/Time'),
  Command = require('../classes/Command'),
  Server = require('../classes/Server');

module.exports = new Command({
  name: 'nextep',
  help: () => 'Returns the season, episode number and title of the next episode along with relative air time',
  perm: 'everyone',
  usage: [true],
  allowPM: true,
  action: args => {
    unirest.get(process.env.SITE_ABSPATH + process.env.SITE_APIPATH + '/show/next')
      .header("Accept", "application/json")
      .end(function (result) {
        if (result.error || typeof result.body !== 'object') {
          console.log(result.error, result.body);
          return Server.reply(args.message, `Request to the website's API failed (HTTP ${result.status}). ${Server.mentionOwner(args.authorID)} should see what caused the issue in the logs.`);
        }

        const data = result.body;

        if (!data.status) {
          if (data.hiatus) {
            const dbSearchQuery = 'animated, safe, crying, sad, -happy, -webm, screencap, -meme, -text, -telekinesis, -star tracker';
            unirest.get(`https://derpibooru.org/api/v1/json/search/images?q=${dbSearchQuery}&filter_id=8575&sf=random&perpage=1`)
              .header("Accept", "application/json")
              .end(function (result) {
                Server.respondWithDerpibooruImage(args, result.body.images[0], true);
              });
            return;
          }
          return Server.reply(args.message, data.message);
        }

        const
          which = data.episode === 1 ? 'first' : nth.appendSuffix(data.episode),
          when = Time.Remaining(new Date(), new Date(data.airs));
        let sentence = `The ${which} episode of season ${data.season} titled ${data.title} is going to air ${when}`;
        Server.reply(args.message, sentence);
      });
  }
});
