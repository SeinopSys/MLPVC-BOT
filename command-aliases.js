const list = {
	'colorguide': ['cg','guide','colors'],
	'define': 'def',
	'derpibooru': ['db','derpi'],
	'version': 'ver',
	'tutorials': 'tut',
	'eval': 'e',
	'nextep': ['horsewhen','cd'],
	'youtube': 'yt',
};

const assoc = {};
for (let command in list){
	if (!list.hasOwnProperty(command))
		continue;

	const aliases = list[command];

	if (typeof aliases === 'string'){
		assoc[aliases] = command;
		continue;
	}

	// jshint -W083
	aliases.forEach(alias => {
		assoc[alias] = command;
	});
}

module.exports = {
	list,
	assoc,
};
