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
	redisClient.hset(constants.ADMINS, MASTER_LOGIN.username, hash(MASTER_LOGIN.password), (err) => {
		if (err) throw err;
	});
	function matches(username, password, callback) {
		redisClient.hget(constants.ADMINS, username, (err, data) => {
			callback(data === hash(password));
		});
	}
	function isUnexpired(sessionKey, callback, earlyWarning) {
		if (sessionKey === undefined) {
			callback(false);
			return;
		}
		let offset;
		if (earlyWarning) offset = ONE_DAY;
		else offset = 0;
		redisClient.hget(constants.SESSION_KEYS, sessionKey, (err, expiry) => {
			if (err) throw err;
			else callback(expiry && Number(expiry) > new Date().getTime() + offset);
		});
	}
	function respondIfUnexpired(sessionKey, res, callback) {
		isUnexpired(sessionKey, (unexpired) => {
			if (unexpired) callback();
			else res.end(JSON.stringify({'success': false, 'message': 'Session expired'}));
		}, false);
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
			isUnexpired(sessionKey, (unexpired) => res.end(JSON.stringify({'unexpired': unexpired})), true);
		},
		'getAdmins': (sessionKey, res) => {
			respondIfUnexpired(sessionKey, res, () => {
				redisClient.hkeys(constants.ADMINS, (err, admins) => {
					if (err) throw err;
					else {
						admins.splice(admins.indexOf(MASTER_LOGIN.username), 1);
						res.end(JSON.stringify({'success': true, 'admins': admins}));
					}
				});
			});
		},
		'getSubmissions': (sessionKey, res) => {
			let cutoffTime = new Date().getTime(); //if post is created, all submissions before this time should be deleted
			respondIfUnexpired(sessionKey, res, () => {
				redisClient.zrange(constants.NEW_SUBMISSIONS, 0, -1, 'withscores', (err, submissions) => {
					if (err) throw err;
					else {
						let submissionTimes = [];
						for (let i = 0; i < submissions.length; i += 2) {
							submissionTimes.push({'quote': submissions[i], 'date': Number(submissions[i + 1])});
						}
						res.end(JSON.stringify({'success': true, 'submissions': submissionTimes, 'cutoffTime': cutoffTime}));
					}
				});
			});
		},
		'getVotes': (sessionKey, res) => {
			respondIfUnexpired(sessionKey, res, () => {
				redisClient.hgetall(constants.CURRENT_VOTES, (err, votes) => {
					if (err) throw err;
					else {
						for (let quote in votes) votes[quote] = Number(votes[quote]);
						res.end(JSON.stringify({'success': true, 'votes': votes}));
					}
				});
			});
		},
		'add': (sessionKey, username, password, res) => {
			if (username === undefined || password === undefined) {
				res.end(JSON.stringify({'success': false, 'message': 'No username or password specified'}));
				return;
			}
			respondIfUnexpired(sessionKey, res, () => {
				redisClient.hexists(constants.ADMINS, username, (err, exists) => {
					if (err) throw err;
					else {
						if (exists) res.end(JSON.stringify({'success': false, 'message': 'User already exists'}));
						else {
							redisClient.hset(constants.ADMINS, username, hash(password), (err) => {
								if (err) throw err;
								else res.end(JSON.stringify({'success': true}));
							});
						}
					}
				});
			});
		},
		'remove': (sessionKey, username, res) => {
			if (username === undefined) {
				res.end(JSON.stringify({'success': false, 'message': 'No username specified'}));
				return;
			}
			respondIfUnexpired(sessionKey, res, () => {
				if (username === MASTER_LOGIN.username) res.end(JSON.stringify({'success': false, 'message': 'Cannot remove master'}));
				else {
					redisClient.hdel(constants.ADMINS, username, (err, deleted) => {
						if (err) throw err;
						else {
							if (deleted) res.end(JSON.stringify({'success': true}));
							else res.end(JSON.stringify({'success': false, 'message': 'No such user exists'}));
						}
					});
				}
			});
		}
	};
};