var async = require('async');
var writeFileR = require('./writeFileR');
var spritesheetTemplater = require('spritesheet-templates');
var sendToPast = require('./sendToPast');

module.exports = function writeCSS(sources, templaterData, shouldSendToPast, callback) {
    var apis = sources.map(function (css) {
        return {
            file: css[0],
            code: spritesheetTemplater(templaterData, css[1])
        };
    });

    async.forEach(apis, function (api, callback) {
        async.series([
            writeFileR.bind(null, api.file, api.code),
            sendToPast.bind(null, api.file, !shouldSendToPast)
        ], callback);
    }, callback);
};
