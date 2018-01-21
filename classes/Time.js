const moment = require('moment-timezone');

class DateFormatError extends Error {
	constructor(message, element){
		super(message);

        this.name = 'DateFormatError';
		this.element = element;
	}
}

class Time {
	static Difference(now, timestamp) {
		const
			current = now.getTime(),
			target = timestamp.getTime(),
			diff = current - target;
		let dur = moment.duration(diff),
			d = { past: diff > 0 };

		['years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds'].forEach(unit => {
			const singular = unit.replace(/s$/,'');
			d[singular] = dur[unit]();
			if (d[singular] > 0)
				dur.subtract(d[singular], unit);
		});

		return d;
	}

	static Remaining(now, timestamp){
		const diff = this.Difference(now, timestamp);
		let out = [];
		['year','month','week','day','hour','minute','second'].forEach(key => diff[key] > 0 ? out.push(diff[key]+' '+key+(diff[key]!==1?'s':'')) : null);
		const ret = out.join(', ').replace(/, ([^,]+)$/g,' and $1');
		return diff.past ? ret+' ago' : 'in '+ret;
	}
}
Time.InSeconds = {
	'year':   31557600,
	'month':  2592000,
	'week':   604800,
	'day':    86400,
	'hour':   3600,
	'minute': 60,
};

module.exports = Time;
