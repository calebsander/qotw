const constants = require(__dirname + '/../api/constants.js')
const https = require('https')
const htmlSoup = require('html-soup')
const redis = require('redis')

function getFirstElement(set) {
	for (const element of set) return element
}
function makeRequest(url, callback) {
	https.get(url, res => {
		const chunks = []
		res.on('data', chunk => chunks.push(chunk))
		res.on('end', () => callback(Buffer.concat(chunks)))
	})
}
const MAIN_LIST = 'https://lists.qotw.net/pipermail/quoteoftheweek/';
makeRequest(MAIN_LIST, body => {
	const dom = htmlSoup.parse(body)
	const rows = htmlSoup.select(dom, 'tr')
	for (const row of rows) {
		const linksTd = row.children[1]
		const dateLink = htmlSoup.select(linksTd, 'a:last-of-type')
		if (!dateLink.size) continue
		findMailings(MAIN_LIST + getFirstElement(dateLink).attributes.href)
	}
})
function findMailings(url) {
	makeRequest(url, body => {
		const dom = htmlSoup.parse(body)
		const links = htmlSoup.select(dom, 'a[href$=".html"]')
		for (const link of links) addToArchives(url.substring(0, url.lastIndexOf('/') + 1) + link.attributes.href) //calculate relative link
	})
}
const PRE = '<PRE>'
const PRE_CLOSE = '</PRE>'
const DATE_MATCH = /^[A-Z][a-z]{2} [A-Z][a-z]{2}  ?\d\d? \d\d:\d\d:\d\d E[DS]T \d\d\d\d$/
function addToArchives(url) {
	makeRequest(url, body => {
		body = body.toString().replace(/&In-Reply-To/g, '&amp;In-Reply-To')
		const dom = htmlSoup.parse(body)
		const italics = htmlSoup.select(dom, 'i')
		const title = getFirstElement(htmlSoup.select(dom, 'title')).children[0].text
		const preIndex = body.indexOf(PRE)
		const indexAfterPreTag = preIndex + PRE.length
		if (preIndex === -1 || body.indexOf(PRE, indexAfterPreTag) !== -1) throw new Error('Wrong number of pres for ' + url)
		const redisClient = redis.createClient()
		const fullBody = body.substring(indexAfterPreTag, body.indexOf(PRE_CLOSE, indexAfterPreTag)).trim()
		for (const italic of italics) {
			if (!italic.children.length) continue
			const {text} = italic.children[0]
			if (DATE_MATCH.test(text)) {
				const time = new Date(text).getTime()
				redisClient.zadd(constants.ARCHIVES, time, JSON.stringify({
					title,
					timestamp: time,
					body: fullBody
				}), err => {
					if (err) throw err
				})
			}
		}
		redisClient.quit()
	})
}