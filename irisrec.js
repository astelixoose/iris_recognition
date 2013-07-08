
var util = require('util'),
	fs = require('fs'),
	gm = require('gm');


/**
 * Identyfikacja teczowki oka
 * 
 * @param irisName nazwa
 * @param dir sciezka do zdjecia teczowki oka
 */
exports.identify = function(irisName, dir) {
	console.log(util.inspect('irisRecognition', false, null));
	console.log(util.inspect(dir + irisName, false, null));
	console.log(util.inspect(dir + 'r_' + irisName, false, null));
	
	gm(dir + irisName)
	.resize('200', '200')
	.write(dir + 'r_' + irisName, function (err) {
		if (err) console.log(util.inspect(err, false, null));
	});
	
	
//	.stream(function (err, stdout, stderr) {
//	  var writeStream = fs.createWriteStream('/path/to/my/resized.jpg');
//	  stdout.pipe(writeStream);
//	});
}