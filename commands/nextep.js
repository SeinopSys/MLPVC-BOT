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
    unirest.get(process.env.BACKEND_BASE_URL + 'api/private/show/next')
      .header("Accept", "application/json")
      .header("User-Agent", process.env.UA_STRING)
      .end(function (result) {
        if (result.error || typeof result.body !== 'object') {
          console.log(result.error, result.body);
          return Server.reply(args.message, `Request to the website's API failed (HTTP ${result.status}). ${Server.mentionOwner(args.authorID)} should see what caused the issue in the logs.`);
        }

        const data = result.body;

        if (!data.status) {
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
