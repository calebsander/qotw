const constants = require(__dirname + '/constants.js')

function ifErrThrowErr(err) {
	if (err) throw err
}

module.exports = redisClient => {
	return (key, res) => {
		redisClient.hexists(constants.SUBSCRIBE_KEY_MAP, key, (err, exists) => {
			if (err) throw err
			if (exists) {
				redisClient.hget(constants.SUBSCRIBE_KEY_MAP, key, (err, email) => {
					if (err) throw err
					redisClient.sadd(constants.EMAILS, email, ifErrThrowErr)
					redisClient.hdel(constants.SUBSCRIBE_KEY_MAP, key, ifErrThrowErr)
					redisClient.srem(constants.KEYS, key, ifErrThrowErr)
					res.end(JSON.stringify({success: true}))
					console.log('Subscribed ' + email)
				})
			}
			else res.end(JSON.stringify({success: false, message: "Key doesn't exist"}))
		})
	}
}