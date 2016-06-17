const crypto = require('crypto');

module.exports = (alreadyUsed) => {
	let key;
	while (alreadyUsed(key = crypto.randomBytes(48).toString('hex')));
	return key;
};