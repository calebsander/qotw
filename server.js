const compile = require(__dirname + '/compile.js')
const http = require('http')
const redis = require('redis')
const fileserver = require(__dirname + '/node-libraries/fileserver/fileserver.js')
const serv = fileserver(compile.getCompiledDir(), true)
const servStream = fileserver.servStream
const url = require('url')

const redisClient = redis.createClient()
const API_DIR = __dirname + '/api/'
const archives = require(API_DIR + 'archives.js')(redisClient, servStream)
const confirm = require(API_DIR + 'confirm.js')(redisClient)
const lastMessage = require(API_DIR + 'last-message.js')(redisClient, servStream)
const message = require(API_DIR + 'message.js')(redisClient, servStream)
const paragraphs = require(API_DIR + 'paragraphs.js')(redisClient, servStream)
const submit = require(API_DIR + 'submit.js')(redisClient)
const subscribe = require(API_DIR + 'subscribe.js')(redisClient)
const vote = require(API_DIR + 'vote.js')(redisClient)
const adminUsers = require(API_DIR + 'admin-users.js')(redisClient)

function addZero(num) {
	if (num < 10) return '0' + String(num)
	else return String(num)
}
function formatDate() {
	const date = new Date
	const hours = date.getHours()
	return addZero(date.getMonth() + 1) + '/' + addZero(date.getDate()) + ' ' + String((hours + 11) % 12 + 1) + ':' + addZero(date.getMinutes()) + ':' + addZero(date.getSeconds()) + ' ' + ((hours > 11) ? 'PM' : 'AM')
}
function readPostString(req, callback) {
	const chunks = []
	let length = 0
	req.on('data', chunk => {
		if (length + chunk.length > 1e6) req.destroy()
		else {
			chunks.push(chunk)
			length += chunk.length
		}
	})
	req.on('end', () => callback(Buffer.concat(chunks).toString()))
}

http.createServer((req, res) => {
	console.log(formatDate() + ' Request to ' + req.url + ' from ' + req.connection.remoteAddress)
	try {
		const query = url.parse(req.url, true).query
		let sessionKey
		if (req.url.startsWith('/admin/')) sessionKey = query.key

		if (req.url === '/api/lastmessage') lastMessage(res)
		else if (req.url === '/api/archives') archives(res)
		else if (req.url === '/api/paragraphs') paragraphs(res)
		else if (req.url === '/api/submit') readPostString(req, quote => submit(quote, res))
		else if (req.url === '/api/vote') readPostString(req, voteData => vote(JSON.parse(voteData), res))
		else if (req.url === '/admin/compose') readPostString(req, composeData => adminUsers.compose(JSON.parse(composeData), res))
		else if (req.url.startsWith('/api/subscribe?email=')) subscribe(query.email, res)
		else if (req.url.startsWith('/api/confirm?key=')) confirm(query.key, res)
		else if (req.url.startsWith('/api/message?id=')) message(query.id, res)
		else if (req.url.startsWith('/admin/login?')) adminUsers.createSession(query.username, query.password, res)
		else if (req.url.startsWith('/admin/checkkey?key=')) adminUsers.checkExpired(sessionKey, res)
		else if (req.url.startsWith('/admin/submissions?key=')) adminUsers.getSubmissions(sessionKey, res)
		else if (req.url.startsWith('/admin/votes?key=')) adminUsers.getVotes(sessionKey, res)
		else if (req.url.startsWith('/admin/admins?key=')) adminUsers.getAdmins(sessionKey, res)
		else if (req.url.startsWith('/admin/addadmin?')) adminUsers.add(sessionKey, query.username, query.password, res)
		else if (req.url.startsWith('/admin/rmadmin?')) adminUsers.remove(sessionKey, query.username, res)
		else {
			const questionIndex = req.url.indexOf('?')
			if (questionIndex !== -1) req.url = req.url.substring(0, questionIndex) //strip parameters off request when serving files
			serv(res, req)
		}
	}
	catch (e) {
		console.error(e)
		res.writeHead(404)
		res.end('An error occurred')
	}
}).listen(80)

compile.compileAll()
console.log('Ready')