const constants = require(__dirname + '/constants.js');

module.exports = (redisClient) => {
	return (quote, res) => {
		redisClient.zadd(constants.NEW_SUBMISSIONS, new Date().getTime(), quote, (err) => {
			if (err) throw err;
			else res.end(JSON.stringify({'success': true}));
		});
	};
};