class DateFormatError extends Error {
	constructor(message, element){
		super(message);

        this.name = 'DateFormatError';
		this.element = element;
	}
}

class Time {
	static Difference(now, timestamp) {
		let substract = (now.getTime() - timestamp.getTime())/1000,
			d = {
				past: substract > 0,
				time: Math.abs(substract),
				target: timestamp
			},
			time = d.time;

		d.day = Math.floor(time/this.InSeconds.day);
		time -= d.day * this.InSeconds.day;

		d.hour = Math.floor(time/this.InSeconds.hour);
		time -= d.hour * this.InSeconds.hour;

		d.minute = Math.floor(time/this.InSeconds.minute);
		time -= d.minute * this.InSeconds.minute;

		d.second = Math.floor(time);

		if (d.day >= 7){
			d.week = Math.floor(d.day/7);
			d.day -= d.week*7;
		}
		if (d.week >= 4){
			d.month = Math.floor(d.week/4);
			d.week -= d.month*4;
		}
		if (d.month >= 12){
			d.year = Math.floor(d.month/12);
			d.month -= d.year*12;
		}

		return d;
	}

	static Remaining(now, timestamps){
		const diff = this.Difference(now, timestamps);
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
