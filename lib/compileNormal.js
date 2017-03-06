var Spritesmith = require('spritesmith');
var path = require('path');
var async = require('async');
var _ = require('lodash');

var substitute = require('./substitute');
var writeCSS = require('./writeCSS');
var writeFileR = require('./writeFileR');

module.exports = function (options, metaOutput, srcFiles, callback) {
    var spritesmithOptions = _.assign({
        src: srcFiles.map(function (filename) {
            return path.resolve(options.src.cwd, filename);
        })
    }, options.spritesmithOptions);

    async.waterfall([
        Spritesmith.run.bind(Spritesmith, spritesmithOptions),
        function emitFiles(spritesmithResult, callback) {
            var imageNameWithSubstitutions = substitute(options.target.image, spritesmithResult);
            async.parallel([
                writeCSS.bind(null, options.target.css, toSpritesheetTemplatesFormat(spritesmithResult)),
                writeFileR.bind(null, imageNameWithSubstitutions, spritesmithResult.image, 'binary')
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
                return _.assign(
                    {name: generateSpriteName(fileName)},
                    oneSourceInfo
                );
            }
        );
        var imageRefWithSubstitutions = substitute(options.apiOptions.cssImageRef, spritesmithResult);
        var spritesheet = _.assign(
            {image: imageRefWithSubstitutions},
            spritesmithResult.properties
        );

        return {
            sprites: sprites,
            spritesheet: spritesheet
        };
    }
};
