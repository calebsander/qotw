const constants = require(__dirname + '/constants.js')
const makeStream = require(__dirname + '/../stream.js')

function ifErrThrowErr(err) {
	if (err) throw err
}

module.exports = (redisClient, servStream) => {
	return res => {
		redisClient.lrange(constants.PARAGRAPHS, 0, -1, (err, data) => {
			if (err) throw err
			function reply() {
				const stream = makeStream()
				stream.push(JSON.stringify(data))
				stream.push(null)
				servStream(res, 'application/json', stream)
			}
			if (data.length) reply()
			else { //paragraphs haven't been calculated yet
				redisClient.zrange(constants.ARCHIVES, -1, -1, (err, posts) => {
					if (err) throw err
					data = JSON.parse(posts[0]).body.split(/(?:\n|<br\s*\/?\s*>){2,}/)
					reply()
					redisClient.rpush(constants.PARAGRAPHS, ...data, ifErrThrowErr)
				})
			}
		})
	}
}