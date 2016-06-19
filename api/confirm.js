const constants = require(__dirname + '/constants.js');

module.exports = (redisClient) => {
	function logSubscribers() {
		redisClient.smembers(constants.EMAILS, (err, members) => {
			if (err) throw err;
		});
	}
	return (key, res) => {
		redisClient.hexists(constants.SUBSCRIBE_KEY_MAP, key, (err, exists) => {
			if (err) throw err;
			else {
				if (exists) {
					redisClient.hget(constants.SUBSCRIBE_KEY_MAP, key, (err, email) => {
						if (err) throw err;
						else {
							redisClient.sadd(constants.EMAILS, email, (err) => {
								if (err) throw err;
								else logSubscribers();
							});
							redisClient.hdel(constants.SUBSCRIBE_KEY_MAP, key);
							redisClient.srem(constants.KEYS, key);
							res.end(JSON.stringify({'success': true}));
						}
					});
				}
				else res.end(JSON.stringify({'success': false, 'message': "Key doesn't exist"}));
			}
		});
	};
};