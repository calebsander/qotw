# qotw
A replacement for [qotw.net](https://www.qotw.net/)

Functionality:
- Submitting quotes
- Browsing archives of mailings
- Subscribing to future mailings
- Sending out mailings
- Voting on quotes

It uses Redis for all database needs and AWS SES to handle emailing. Most of the page rendering takes place client-side.

To run your own instance, you would need to:
- Set the base URL of the server (e.g. `https://www.qotw.net`) in `api/domain.txt`
- Set the keys `accessKeyId` and `secretAccessKey` and `region` in `api/aws.json`
- Set the key `user` in `api/email-auth.json` to an e-mail address you control
- Give your SES permission to send e-mails as that e-mail account
- Set the keys `username` and `password` in `api/master-login.json`
- Install NodeJS
- `$ npm install`
- `$ sudo nodejs server.js`
