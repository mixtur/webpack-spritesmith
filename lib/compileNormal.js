var Spritesmith = require('spritesmith');
var path = require('path');
var async = require('async');
var _ = require('lodash');

var writeCSS = require('./writeCSS');
var writeFileR = require('./writeFileR');

module.exports = function (options, metaOutput, srcFiles, callback) {
    var spritesmithOptions = _.extend({
        src: srcFiles.map(function (filename) {
            return path.resolve(options.src.cwd, filename);
        })
    }, options.spritesmithOptions);

    async.waterfall([
        Spritesmith.run.bind(Spritesmith, spritesmithOptions),
        function (spritesmithResult, callback) {
            async.parallel([
                writeCSS.bind(null, options.target.css, toSpritesheetTemplatesFormat(spritesmithResult)),
                writeFileR.bind(null, options.target.image, spritesmithResult.image, 'binary')
            ], callback);
        }
    ], function (err) {
        if (err) {
            metaOutput.errors.push(err);
        }
        callback();
    });

    function toSpritesheetTemplatesFormat(spritesmithResult) {
        var generateSpriteName = options.apiOptions.generateSpriteName;
        var sprites = _.map(
            spritesmithResult.coordinates,
            function (oneSourceInfo, fileName) {
                return _.extend(
                    {name: generateSpriteName(fileName)},
                    oneSourceInfo
                );
            }
        );
        var spritesheet = _.extend(
            {image: options.apiOptions.cssImageRef},
            spritesmithResult.properties
        );

        return {
            sprites: sprites,
            spritesheet: spritesheet
        };
    }
};
