const constants = require(__dirname + '/constants.js')
const crypto = require('crypto')
const fs = require('fs')
const generateKey = require(__dirname + '/generate-key.js')
const sendEmail = require(__dirname + '/send-email.js')

function hash(password) {
	let sha2hash = crypto.createHash('sha256')
	sha2hash.update(password)
	return sha2hash.digest('hex')
}
const MASTER_LOGIN = JSON.parse(fs.readFileSync(__dirname + '/master-login.json'))
const ONE_DAY = 86400000
const EXPIRE_TIME = ONE_DAY * 2

function ifErrThrowErr(err) {
	if (err) throw err
}
function htmlSafe(str) {
	return str.replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
const COMPOSE_KEYS = ['title', 'body', 'cutoffTime']

module.exports = redisClient => {
	redisClient.hset(constants.ADMINS, MASTER_LOGIN.username, hash(MASTER_LOGIN.password), ifErrThrowErr)
	function matches(username, password, callback) {
		redisClient.hget(constants.ADMINS, username, (err, data) => {
			callback(data === hash(password))
		})
	}
	function isUnexpired(sessionKey, callback, earlyWarning) {
		if (!sessionKey) {
			callback(false)
			return
		}
		let offset
		if (earlyWarning) offset = ONE_DAY
		else offset = 0
		redisClient.hget(constants.SESSION_KEYS, sessionKey, (err, expiry) => {
			if (err) throw err
			callback(expiry && Number(expiry) > new Date().getTime() + offset)
		})
	}
	function respondIfUnexpired(sessionKey, res, callback) {
		isUnexpired(sessionKey, unexpired => {
			if (unexpired) callback()
			else res.end(JSON.stringify({success: false, message: 'Session expired'}))
		}, false)
	}
	return {
		createSession(username, password, res) {
			if (password) {
				matches(username, password, correct => {
					if (correct) {
						redisClient.hkeys(constants.SESSION_KEYS, (err, keys) => {
							if (err) throw err
							keys = new Set(keys)
							const sessionKey = generateKey(key => keys.has(key))
							redisClient.hset(constants.SESSION_KEYS, sessionKey, new Date().getTime() + EXPIRE_TIME, ifErrThrowErr)
							res.end(JSON.stringify({success: true, sessionKey: sessionKey}))
						})
					}
					else res.end(JSON.stringify({success: false, message: 'Invalid username or password'}))
				})
			}
			else res.end(JSON.stringify({success: false, message: 'No password provided'}))
		},
		checkExpired(sessionKey, res) {
			isUnexpired(sessionKey, unexpired => res.end(JSON.stringify({unexpired})), true)
		},
		getAdmins(sessionKey, res) {
			respondIfUnexpired(sessionKey, res, () => {
				redisClient.hkeys(constants.ADMINS, (err, admins) => {
					if (err) throw err
					admins.splice(admins.indexOf(MASTER_LOGIN.username), 1)
					res.end(JSON.stringify({'success': true, 'admins': admins}))
				})
			})
		},
		getSubmissions(sessionKey, res) {
			const cutoffTime = new Date().getTime() //if post is created, all submissions before this time should be deleted
			respondIfUnexpired(sessionKey, res, () => {
				redisClient.zrange(constants.NEW_SUBMISSIONS, 0, -1, 'withscores', (err, submissions) => {
					if (err) throw err
					let submissionTimes = []
					for (let i = 0; i < submissions.length; i += 2) {
						submissionTimes.push({quote: submissions[i], date: Number(submissions[i + 1])})
					}
					res.end(JSON.stringify({success: true, submissions: submissionTimes, cutoffTime}))
				})
			})
		},
		getVotes(sessionKey, res) {
			respondIfUnexpired(sessionKey, res, () => {
				redisClient.hgetall(constants.CURRENT_VOTES, (err, votes) => {
					if (err) throw err
					for (const quote in votes) votes[quote] = Number(votes[quote])
					res.end(JSON.stringify({success: true, votes}))
				})
			})
		},
		add(sessionKey, username, password, res) {
			if (username === undefined || password === undefined) {
				res.end(JSON.stringify({success: false, message: 'No username or password specified'}))
				return
			}
			respondIfUnexpired(sessionKey, res, () => {
				redisClient.hexists(constants.ADMINS, username, (err, exists) => {
					if (err) throw err
					if (exists) res.end(JSON.stringify({success: false, message: 'User already exists'}))
					else {
						redisClient.hset(constants.ADMINS, username, hash(password), err => {
							if (err) throw err
							res.end(JSON.stringify({success: true}))
						})
					}
				})
			})
		},
		remove(sessionKey, username, res) {
			if (!username) {
				res.end(JSON.stringify({success: false, message: 'No username specified'}))
				return
			}
			respondIfUnexpired(sessionKey, res, () => {
				if (username === MASTER_LOGIN.username) res.end(JSON.stringify({success: false, message: 'Cannot remove master'}))
				else {
					redisClient.hdel(constants.ADMINS, username, (err, deleted) => {
						if (err) throw err
						if (deleted) res.end(JSON.stringify({success: true}))
						else res.end(JSON.stringify({success: false, message: 'No such user exists'}))
					})
				}
			})
		},
		compose(data, res) {
			for (const key of COMPOSE_KEYS) {
				if (!data[key]) {
					res.end(JSON.stringify({success: false, message: 'Missing ' + key}))
					return
				}
			}
			respondIfUnexpired(data.key, res, () => {
				let time = new Date().getTime()
				let title = '[QOTW] ' + data.title
				let escapedBody = htmlSafe((data.body + '\n\n')).replace(/\n/g, '<br>')
				redisClient.zadd(constants.ARCHIVES, time, JSON.stringify({
					title,
					timestamp: time,
					body: escapedBody
				}), ifErrThrowErr)
				const voteTokens = new Set
				redisClient.del(constants.VOTE_TOKENS, err => {
					if (err) throw err
					redisClient.smembers(constants.EMAILS, (err, members) => {
						if (err) throw err
						for (const address of members) {
							const voteToken = generateKey(key => voteTokens.has(key))
							voteTokens.add(voteToken)
							redisClient.sadd(constants.VOTE_TOKENS, voteToken, ifErrThrowErr)
							sendEmail(address, title, escapedBody + '<a href="' + constants.DOMAIN + '/vote?token=' + voteToken + '">Vote here!</a>')
						}
					})
					res.end(JSON.stringify({success: true}))
				})
				redisClient.del(constants.CURRENT_VOTES, ifErrThrowErr)
				redisClient.zremrangebyscore(constants.NEW_SUBMISSIONS, '-inf', data.cutoffTime, ifErrThrowErr)
			})
		}
	}
}