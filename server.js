const compile = require(__dirname + '/compile.js');
const http = require('http');
const redis = require('redis');
const fileserver = require(__dirname + '/node-libraries/fileserver/fileserver.js');
const serv = fileserver(compile.getCompiledDir(), true);
const servStream = fileserver.servStream;
const url = require('url');

const redisClient = redis.createClient();
const API_DIR = __dirname + '/api/';
const archives = require(API_DIR + 'archives.js')(redisClient, servStream);
const confirm = require(API_DIR + 'confirm.js')(redisClient);
const lastMessage = require(API_DIR + 'last-message.js')(redisClient, servStream);
const message = require(API_DIR + 'message.js')(redisClient, servStream);
const submit = require(API_DIR + 'submit.js')(redisClient);
const subscribe = require(API_DIR + 'subscribe.js')(redisClient);
const vote = require(API_DIR + 'vote.js')(redisClient);
const adminUsers = require(API_DIR + 'admin-users.js')(redisClient);

function addZero(num) {
	if (num < 10) return '0' + String(num);
	else return String(num);
}
function formatDate() {
	const date = new Date();
	const hours = date.getHours();
	return addZero(date.getMonth() + 1) + '/' + addZero(date.getDate()) + ' ' + String((hours + 11) % 12 + 1) + ':' + addZero(date.getMinutes()) + ':' + addZero(date.getSeconds()) + ' ' + ((hours > 11) ? 'PM' : 'AM');
}
function readPostString(req, callback) {
	let data = '';
	req.on('data', (chunk) => {
		if (data.length + chunk.length > 1e6) req.destroy();
		else data += chunk;
	});
	req.on('end', () => callback(data));
}

http.createServer((req, res) => {
	console.log(formatDate() + ' Request to ' + req.url + ' from ' + req.connection.remoteAddress);
	try {
		if (req.url === '/api/lastmessage') lastMessage(res);
		else if (req.url === '/api/archives') archives(res);
		else if (req.url === '/api/submit') readPostString(req, (quote) => submit(quote, res));
		else if (req.url === '/api/vote') readPostString(req, (voteData) => vote(JSON.parse(voteData), res));
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
		else if (req.url.startsWith('/admin/submissions?key=')) {
			let sessionKey = url.parse(req.url, true).query.key;
			adminUsers.getSubmissions(sessionKey, res);
		}
		else if (req.url.startsWith('/admin/votes?key=')) {
			let sessionKey = url.parse(req.url, true).query.key;
			adminUsers.getVotes(sessionKey, res);
		}
		else {
			let questionIndex = req.url.indexOf('?');
			if (questionIndex !== -1) req.url = req.url.substring(0, questionIndex); //strip parameters off request when serving files
			serv(res, req);
		}
	}
	catch (e) {
		console.log(e);
		res.writeHead(404);
		res.end('An error occurred');
	}
}).listen(80);

compile.compileAll();
console.log('Ready');