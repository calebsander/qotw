const Stream = require('stream').Readable;

module.exports = () => {
	const stream = new Stream();
	stream._read = () => {};
	return stream;
};