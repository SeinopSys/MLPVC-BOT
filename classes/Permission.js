class Permission {
	constructor(name, checker){
		this.name = name;
		this.check = userID => checker(userID);
	}
}

module.exports = Permission;
