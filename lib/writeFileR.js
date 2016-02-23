var async = require('async');
var mkdirp = require('mkdirp');
var path = require('path');
var fs = require('fs');

module.exports = function (fileName) {
    var args = Array.prototype.slice.call(arguments);
    var callback = arguments[arguments.length - 1];
    async.series([
        mkdirp.bind(null, path.dirname(fileName)),
        function (callback) {
            args[args.length - 1] = callback;
            return fs.writeFile.apply(fs, args);
        }
    ], callback);
};
