const constants = require(__dirname + '/constants.js');
const crypto = require('crypto');
const fs = require('fs');
const generateKey = require(__dirname + '/generate-key.js');

function hash(password) {
	let sha2hash = crypto.createHash('sha256');
	sha2hash.update(password);
	return sha2hash.digest('hex');
}
const MASTER_LOGIN = JSON.parse(fs.readFileSync(__dirname + '/master-login.json'));
const ONE_DAY = 86400000;
const EXPIRE_TIME = ONE_DAY * 2;

module.exports = (redisClient) => {
	redisClient.hset(constants.USERS, MASTER_LOGIN.username, hash(MASTER_LOGIN.password), (err) => {
		if (err) throw err;
	});
	function matches(username, password, callback) {
		redisClient.hget(constants.USERS, username, (err, data) => {
			callback(data === hash(password));
		});
	}
	function isUnexpired(sessionKey, callback) {
		if (sessionKey === undefined) {
			callback(false);
			return;
		}
		redisClient.hget(constants.SESSION_KEYS, sessionKey, (err, expiry) => {
			if (err) throw err;
			else callback(expiry && Number(expiry) > new Date().getTime() + ONE_DAY);
		});
	}
	return {
		'createSession': (username, password, res) => {
			if (password) {
				matches(username, password, (correct) => {
					if (correct) {
						redisClient.hkeys(constants.SESSION_KEYS, (err, keys) => {
							if (err) throw err;
							else {
								let sessionKey = generateKey((key) => keys.indexOf(key) !== -1);
								redisClient.hset(constants.SESSION_KEYS, sessionKey, new Date().getTime() + EXPIRE_TIME, (err) => {
									if (err) throw err;
								});
								res.end(JSON.stringify({'success': true, 'sessionKey': sessionKey}));
							}
						});
					}
					else res.end(JSON.stringify({'success': false, 'message': 'Invalid username or password'}));
				});
			}
			else res.end(JSON.stringify({'success': false, 'message': 'No password provided'}));
		},
		'checkExpired': (sessionKey, res) => {
			isUnexpired(sessionKey, (unexpired) => res.end(JSON.stringify({'unexpired': unexpired})));
		},
		'getVotes': (sessionKey, res) => {
			isUnexpired(sessionKey, (unexpired) => {
				if (unexpired) {
					redisClient.hgetall(constants.CURRENT_VOTES, (err, votes) => {
						if (err) throw err;
						else res.end(JSON.stringify({'success': true, 'votes': votes}));
					});
				}
				else res.end(JSON.stringify({'success': false, 'message': 'Session expired'}));
			});
		}
	};
};