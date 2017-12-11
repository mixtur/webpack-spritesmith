var Spritesmith = require('spritesmith');
var path = require('path');
var async = require('async');
var _ = require('lodash');

var substitute = require('./substitute');
var writeCSS = require('./writeCSS');
var writeFileR = require('./writeFileR');
var sendToPast = require('./sendToPast');

module.exports = function (options, metaOutput, isInitial, srcFiles, callback) {
    var spritesmithOptions = _.assign({
        src: srcFiles.map(function (filename) {
            return path.resolve(options.src.cwd, filename);
        })
    }, options.spritesmithOptions);

    async.waterfall([
        Spritesmith.run.bind(Spritesmith, spritesmithOptions),
        function emitFiles(spritesmithResult, callback) {
            var imageNameWithSubstitutions = substitute(options.target.image, spritesmithResult);
            async.waterfall([
                async.parallel.bind(async, [
                    writeCSS.bind(null, options.target.css, toSpritesheetTemplatesFormat(spritesmithResult), isInitial),
                    async.series.bind(async, [
                        writeFileR.bind(null, imageNameWithSubstitutions, spritesmithResult.image, 'binary'),
                        sendToPast.bind(null, imageNameWithSubstitutions, !isInitial)
                    ])
                ]),
                async.asyncify(function (writeResults) {
                    return {
                        css: writeResults[0],
                        images: [imageNameWithSubstitutions]
                    };
                })
            ], callback);
        }
    ], function (err, targetPaths) {
        if (err) {
            metaOutput.errors.push(err);
        }
        callback(null, targetPaths);
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
