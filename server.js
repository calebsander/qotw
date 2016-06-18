const compile = require(__dirname + '/compile.js');
const http = require('http');
const redis = require('redis');
const fileserver = require(__dirname + '/node-libraries/fileserver/fileserver.js');
const serv = fileserver(compile.getCompiledDir(), true);
const servStream = fileserver.servStream;
const url = require('url');

const redisClient = redis.createClient();
const archives = require(__dirname + '/api/archives.js')(redisClient, servStream);
const confirm = require(__dirname + '/api/confirm.js')(redisClient);
const lastMessage = require(__dirname + '/api/last-message.js')(redisClient, servStream);
const message = require(__dirname + '/api/message.js')(redisClient, servStream);
const submit = require(__dirname + '/api/submit.js')(redisClient);
const subscribe = require(__dirname + '/api/subscribe.js')(redisClient);
const adminUsers = require(__dirname + '/api/admin-users.js')(redisClient);

function addZero(num) {
	if (num < 10) return '0' + String(num);
	else return String(num);
}
function formatDate() {
	const date = new Date();
	const hours = date.getHours();
	return addZero(date.getMonth() + 1) + '/' + addZero(date.getDate()) + ' ' + String((hours + 11) % 12 + 1) + ':' + addZero(date.getMinutes()) + ':' + addZero(date.getSeconds()) + ' ' + ((hours > 11) ? 'PM' : 'AM');
}

http.createServer((req, res) => {
	console.log(formatDate() + ' Request to ' + req.url + ' from ' + req.connection.remoteAddress);
	if (req.url === '/api/lastmessage') lastMessage(res);
	else if (req.url === '/api/archives') archives(res);
	else if (req.url === '/api/submit') {
		let quote = '';
		req.on('data', (chunk) => {
			if (quote.length + chunk.length > 1e6) req.destroy();
			else quote += chunk;
		});
		req.on('end', () => submit(quote, res));
	}
	else if (req.url.startsWith('/api/subscribe?email=')) {
		let email = url.parse(req.url, true).query.email;
		subscribe(email, res);
	}
	else if (req.url.startsWith('/api/confirm?key=')) {
		let key = url.parse(req.url, true).query.key;
		confirm(key, res);
	}
	else if (req.url.startsWith('/api/message?id=')) {
		let id = url.parse(req.url, true).query.id;
		message(id, res);
	}
	else if (req.url.startsWith('/admin/login?username=')) {
		let query = url.parse(req.url, true).query;
		adminUsers.createSession(query.username, query.password, res);
	}
	else if (req.url.startsWith('/admin/checkkey?key=')) {
		let sessionKey = url.parse(req.url, true).query.key;
		adminUsers.checkExpired(sessionKey, res);
	}
	else {
		let questionIndex = req.url.indexOf('?');
		if (questionIndex !== -1) req.url = req.url.substring(0, questionIndex);
		serv(res, req);
	}
}).listen(80);

compile.compileAll();
console.log('Ready');