const constants = require(__dirname + '/../api/constants.js');
const https = require('https');
const htmlEntities = require('he');
const htmlParser = require('htmlparser');
const redis = require('redis');
const select = require('soupselect').select;

function makeRequest(url, callback) {
	https.get(url, (res) => {
		var body = '';
		res.on('data', (chunk) => body += chunk);
		res.on('end', () => callback(body));
	});
}
const MAIN_LIST = 'https://lists.qotw.net/pipermail/quoteoftheweek/';
makeRequest(MAIN_LIST, (body) => {
	const handler = new htmlParser.DefaultHandler((err, dom) => {
		if (err) throw err;
		else {
			const rows = select(dom, 'tr');
			for (let i = 1; i < rows.length; i++) {
				findMailings(MAIN_LIST + rows[i].children[1].children[3].attribs.href);
			}
		}
	});
	const parser = new htmlParser.Parser(handler);
	parser.parseComplete(body.replace(/\<A/g, '<a').replace(/  /g, '').replace(/\n/g, ''));
});
function findMailings(url) {
	makeRequest(url, (body) => {
		const handler = new htmlParser.DefaultHandler((err, dom) => {
			if (err) throw err;
			else {
				const links = select(dom, 'a');
				for (let link in links) {
					link = links[link];
					if (link.attribs.HREF && link.attribs.HREF.indexOf('http://') === -1) {
						addToArchives(url.substring(0, url.lastIndexOf('/') + 1) + link.attribs.HREF);
					}
				}
			}
		});
		const parser = new htmlParser.Parser(handler);
		parser.parseComplete(body.replace(/  /g, '').replace(/\n/g, '').replace(/<A/g, '<a').replace(/\/A>/g, '/a>'));
	});
}
const PRE = '<PRE>';
const PRE_CLOSE = '</PRE>';
const DATE_MATCH = /^[A-Z][a-z]{2} [A-Z][a-z]{2}  ?\d\d? \d\d:\d\d:\d\d E[DS]T \d\d\d\d$/;
function addToArchives(url) {
	makeRequest(url, (body) => {
		const handler = new htmlParser.DefaultHandler((err, dom) => {
			if (err) throw err;
			else {
				const italics = select(dom, 'i');
				const title = select(dom, 'title')[0].children[0].raw.trim();
				const preIndex = body.indexOf(PRE);
				if (preIndex === -1 || body.indexOf(PRE, preIndex + 1) !== -1) console.log('Wrong number of pres for ' + url);
				else {
					const redisClient = redis.createClient();
					const fullBody = body.substring(preIndex + PRE.length, body.indexOf(PRE_CLOSE));
					for (let italic in italics) {
						italic = italics[italic];
						let text = italic.children[0].raw;
						if (DATE_MATCH.test(text)) {
							let time = new Date(text).getTime();
							redisClient.zadd(constants.ARCHIVES, time, JSON.stringify({
								'title': title,
								'timestamp': time,
								'body': htmlEntities.decode(fullBody)
							}), (err) => {
								if (err) throw err;
							});
						}
					}
					redisClient.quit();
				}
			}
		});
		const parser = new htmlParser.Parser(handler);
		parser.parseComplete(body.replace(/<I>/g, '<i>').replace(/<\/I>/g, '</i').replace(/<PRE>/g, '<pre>').replace(/<\/PRE>/g, '</pre>').replace(/<TITLE>/g, '<title>').replace(/<\/TITLE>/g, '</title>'));
	});
}