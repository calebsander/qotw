const constants = require(__dirname + '/constants.js')
const makeStream = require(__dirname + '/../stream.js')

module.exports = (redisClient, servStream) => {
	return res => {
		redisClient.zrange(constants.ARCHIVES, -1, -1, (err, posts) => {
			if (err) throw err
			const stream = makeStream()
			stream.push(posts[0])
			stream.push(null)
			servStream(res, 'application/json', stream)
		})
	}
}