function addZero(number) {
	if (number < 10) return '0' + String(number);
	else return String(number);
}
function formatDate(date, omitTimeOfDay) {
	var dayString = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()] + ' ' + ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][date.getMonth()] + ' ' + String(date.getDate()) + ', ' + String(date.getFullYear());
	if (omitTimeOfDay) return dayString;
	else return dayString + ' at ' + String((date.getHours() + 11) % 12 + 1) + ':' + addZero(date.getMinutes()) + ' ' + (date.getHours() > 11 ? 'PM' : 'AM');
}
var querystring = window.location.href.substring(window.location.href.indexOf('?') + 1);
var query = querystring.split('&');
var keyValuePair;
var params = {}
for (var qwarg = 0; qwarg < query.length; qwarg++) {
	keyValuePair = query[qwarg].split('=');
	params[keyValuePair[0]] = keyValuePair[1];
}