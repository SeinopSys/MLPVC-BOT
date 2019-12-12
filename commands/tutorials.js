const
  Command = require('../classes/Command'),
  Server = require('../classes/Server');

module.exports = new Command({
  name: 'tutorials',
  help: () => 'Sends a link to the club\'s Tutorials folder to the channel.\nAn optional argument allows linking to a subfolder:\n\n' +
    '\t● `anim`/`animation`: Tutorials - Animation\n' +
    '\t● `ai`/`illustrator` : Tutorials - Illustrator\n' +
    '\t● `is`/`inkscape`: Tutorials - Inkscape\n' +
    '\t● `ps`/`photoshop`: Tutorials - Photoshop',
  perm: 'everyone',
  usage: [true, 'ps', 'illustrator'],
  allowPM: true,
  action: args => {
    let url = 'http://mlp-vectorclub.deviantart.com/gallery/34905690/Tutorials';
    if (typeof args.argArr[0] === 'string') {
      switch (args.argArr[0]) {
        case "ai":
        case "illustrator":
          url = 'http://mlp-vectorclub.deviantart.com/gallery/36301008/Tutorials-Illustrator';
          break;
        case "anim":
        case "animation":
          url = 'http://mlp-vectorclub.deviantart.com/gallery/40236819/Tutorials-Animation';
          break;
        case "is":
        case "inkscape":
          url = 'http://mlp-vectorclub.deviantart.com/gallery/36301003/Tutorials-Inkscape';
          break;
        case "ps":
        case "photoshop":
          url = 'http://mlp-vectorclub.deviantart.com/gallery/36301006/Tutorials-Photoshop';
          break;
      }
    }
    Server.reply(args.message, '<' + url + '>');
  }
});
