const constants = require(__dirname + '/constants.js');
const makeStream = require(__dirname + '/../stream.js');

module.exports = (redisClient, servStream) => {
	return (id, res) => {
		id = Number(id);
		if (isNaN(id)) res.end(JSON.stringify({'success': false, 'message': 'invalid post ID'}));
		else {
			redisClient.zrangebyscore(constants.ARCHIVES, id, id, (err, posts) => {
				if (err) throw err;
				else {
					if (posts.length) {
						var response = JSON.parse(posts[0]);
						response.success = true;
						response = JSON.stringify(response);
					}
					else var response = JSON.stringify({'success': false, 'message': 'No such post exists'});
					let stream = makeStream();
					stream.push(response);
					stream.push(null);
					servStream(res, 'application/json', stream);
				}
			});
		}
	};
};