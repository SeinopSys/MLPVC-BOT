const list = {
  'colorguide': ['cg', 'guide', 'colors'],
  'derpibooru': ['db', 'derpi'],
  'version': ['ver'],
  'tutorials': ['tut'],
  'eval': ['e'],
  'nextep': ['horsewhen', 'cd'],
  'vectorapp': ['vapp'],
  'welcomemsg': ['wm'],
  'help': ['cmds','commands'],
};

const assoc = {};
let aliasCount = 0;
Object.keys(list).forEach(command => {
  list[command].forEach(alias => {
    assoc[alias] = command;
    aliasCount++;
  });
});

console.info(`Registered ${aliasCount} command alias${aliasCount !== 1 ? 'es' : ''}`);

module.exports = {
  list,
  assoc,
};
