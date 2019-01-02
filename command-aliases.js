const list = {
	'colorguide': ['cg','guide','colors'],
	'define':     ['def'],
	'derpibooru': ['db','derpi'],
	'version':    ['ver'],
	'tutorials':  ['tut'],
	'eval':       ['e'],
	'nextep':     ['horsewhen','cd'],
	'youtube':    ['yt'],
	'vectorapp':  ['vapp'],
};

const assoc = {};
let aliasCount = 0;
Object.keys(list).forEach(command => {
	list[command].forEach(alias => {
		assoc[alias] = command;
		aliasCount++;
	});
});

console.info(`Registered ${aliasCount} command alias${aliasCount!==1?'es':''}`);

module.exports = {
	list,
	assoc,
};
