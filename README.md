# qotw
A replacement for [qotw.net](https://www.qotw.net/)

Functionality:
- Submitting quotes
- Browsing archives of mailings
- Subscribing to future mailings
- Sending out mailings
- Voting on quotes

It uses Redis for all database needs and AWS SES to handle emailing. Most of the page rendering takes place client-side. The server is currently using http but could be easily switched over to https. Make sure to do that in production because using http would leave you very vulnerable to MITM attacks.

To run your own instance, you would need to:
- Set the base URL of the server (e.g. `https://www.qotw.net`) in `api/domain.txt`
- Set the keys `accessKeyId` and `secretAccessKey` and `region` in `api/aws.json`
- Set the key `user` in `api/email-auth.json` to an e-mail address you control
- Give your SES permission to send e-mails as that e-mail account
- Set the keys `username` and `password` in `api/master-login.json`
- Setup Redis so that the server is running in the background on port `6379` (see [this article](https://www.digitalocean.com/community/tutorials/how-to-install-and-use-redis) for Ubuntu)
- Change Redis config (`redis.conf`) so that `appendonly no` is replaced by `appendonly yes` (so that database is saved after each write) and restart the Redis server
- Install NodeJS
- `$ npm i`
- `$ sudo node server.js`
