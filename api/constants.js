const fs = require('fs');

module.exports = {
	DOMAIN: fs.readFileSync(__dirname + '/domain.txt'),
	//Database names
	EMAILS: 'emails',
	KEYS: 'keys',
	SUBSCRIBE_KEY_MAP: 'subscribe-key-map',
	ADMINS: 'users',
	SESSION_KEYS: 'session-keys',
	ARCHIVES: 'posts',
	NEW_SUBMISSIONS: 'submissions-unused',
	VOTE_TOKENS: 'vote-tokens',
	CURRENT_VOTES: 'current-votes'
};