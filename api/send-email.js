const aws = require('aws-sdk')
const fs = require('fs')

const AUTH_INFO = JSON.parse(fs.readFileSync(__dirname + '/email-auth.json'))
aws.config.loadFromPath(__dirname + '/aws.json')
const ses = new aws.SES()
module.exports = (address, subject, body) => {
	let addresses
	if (address.constructor === Array) addresses = address
	else addresses = [address]
	ses.sendEmail({
		'Source': AUTH_INFO.user,
		'Destination': {
			'ToAddresses': addresses
		},
		'Message': {
			'Subject': {
				'Data': subject
			},
			'Body': {
				'Html': {
					'Data': body
				}
			}
		}
	}, err => {
		if (err) throw err
		console.log('Message sent to ' + addresses.join(', '))
	})
}