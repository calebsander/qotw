const constants = require(__dirname + '/constants.js');
const generateKey = require(__dirname + '/generate-key.js');
const sendEmail = require(__dirname + '/send-email.js');

module.exports = (redisClient) => {
	return (email, res) => {
		redisClient.sismember(constants.EMAILS, email, (err, data) => {
			if (err) throw err;
			else {
				if (data) res.end(JSON.stringify({'success': false, 'message': 'Already subscribed'}));
				else {
					redisClient.smembers(constants.KEYS, (err, data) => {
						if (err) throw err;
						let key = generateKey((key) => data.indexOf(key) !== -1);
						redisClient.sadd(constants.KEYS, key, (err) => {
							if (err) throw err;
						});
						redisClient.hset(constants.SUBSCRIBE_KEY_MAP, key, email, (err) => {
							if (err) throw err;
						});
						let confirmUrl = constants.DOMAIN + '/confirm?key=' + key;
						sendEmail(email, 'Confirm subscription to QOTW', '<a href="' + confirmUrl + '">' + confirmUrl + '</a>');
						res.end(JSON.stringify({'success': true}));
					});
				}
			}
		});
	};
};