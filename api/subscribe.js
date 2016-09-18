const constants = require(__dirname + '/constants.js')
const generateKey = require(__dirname + '/generate-key.js')
const sendEmail = require(__dirname + '/send-email.js')

function ifErrThrowErr(err) {
	if (err) throw err
}

module.exports = redisClient => {
	return (email, res) => {
		redisClient.sismember(constants.EMAILS, email, (err, data) => {
			if (err) throw err
			if (data) res.end(JSON.stringify({'success': false, 'message': 'Already subscribed'}))
			else {
				redisClient.smembers(constants.KEYS, (err, data) => {
					if (err) throw err
					const keys = new Set(data)
					const key = generateKey(key => keys.has(key))
					redisClient.sadd(constants.KEYS, key, ifErrThrowErr)
					redisClient.hset(constants.SUBSCRIBE_KEY_MAP, key, email, ifErrThrowErr)
					const confirmUrl = constants.DOMAIN + '/confirm?key=' + key
					sendEmail(email, 'Confirm subscription to QOTW', '<a href="' + confirmUrl + '">' + confirmUrl + '</a>')
					res.end(JSON.stringify({success: true}))
					console.log('Request to subscribe from ' + email)
				})
			}
		})
	}
}