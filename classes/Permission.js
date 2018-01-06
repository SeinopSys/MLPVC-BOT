class Permission {
	constructor(name, checker){
		this.name = name;
		this.check = authorID => checker(authorID);
	}
}

module.exports = Permission;
