const constants = require(__dirname + '/constants.js');
const makeStream = require(__dirname + '/../stream.js');

module.exports = (redisClient, servStream) => {
	return (res) => {
		redisClient.zrevrange(constants.ARCHIVES, 0, -1, (err, posts) => {
			if (err) throw err;
			else {
				let response = [];
				posts.forEach((post) => {
					post = JSON.parse(post);
					response.push({
						'timestamp': post.timestamp,
						'messageID': String(post.timestamp),
						'title': post.title
					});
				});
				let stream = makeStream();
				stream.push(JSON.stringify({'messages': response}));
				stream.push(null);
				servStream(res, 'application/json', stream);
			}
		});
	};
};