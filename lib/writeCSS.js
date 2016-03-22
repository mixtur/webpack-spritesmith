var async = require('async');
var writeFileR = require('./writeFileR');
var spritesheetTemplater = require('spritesheet-templates');

module.exports = function writeCSS(sources, templaterData, callback) {
    var apis = sources.map(function (css) {
        return {
            file: css[0],
            code: spritesheetTemplater(templaterData, css[1])
        };
    });

    async.forEach(apis, function (api, callback) {
        writeFileR(
            api.file,
            api.code,
            callback
        );
    }, callback);
};
