var Spritesmith = require('spritesmith');
var path = require('path');
var spritesheetTemplater = require('spritesheet-templates');
var async = require('async');
var _ = require('lodash');

var writeFileR = require('./writeFileR');

module.exports = function (options, metaOutput, srcFiles, callback) {
    var classifiedSources = srcFiles.map(function (fileName) {
        return options.retina.classifier(path.resolve(options.src.cwd, fileName));
    });
    var grouppedSources = classifiedSources.reduce(function (acc, source) {
        var name = options.apiOptions.generateSpriteName(source.normalName);
        if (!(name in acc)) {
            acc[name] = {
                apiName: name,
                normalName: source.normalName,
                retinaName: source.retinaName
            }
        }

        acc[name][source.type] = true;

        return acc;
    }, {});

    collectErrors();
    if (metaOutput.errors.length !== 0) {
        return callback();
    }

    var groupByRetinaName = _.keyBy(grouppedSources, 'retinaName');
    var groupByNormalName = _.keyBy(grouppedSources, 'normalName');

    async.waterfall([
        async.parallel.bind(async, [
            Spritesmith.run.bind(Spritesmith, getSpritesmithConfig('normalName')),
            Spritesmith.run.bind(Spritesmith, getSpritesmithConfig('retinaName'))
        ]),
        function (results, callback) {
            addCoordinates(groupByNormalName, 'normalCoordinates', results[0].coordinates);
            addCoordinates(groupByRetinaName, 'retinaCoordinates', results[1].coordinates);

            var normalSprites = getSpritesForSpritesheetTemplates('', 'normalCoordinates');
            var retinaSprites = getSpritesForSpritesheetTemplates('retina_', 'retinaCoordinates');

            var spritesheetTemplatesData = {
                sprites: normalSprites,
                spritesheet: {
                    width: results[0].properties.width,
                    height: results[0].properties.height,
                    image: options.apiOptions.cssImageRef
                },
                retina_sprites: retinaSprites,
                retina_spritesheet: {
                    width: results[1].properties.width,
                    height: results[1].properties.height,
                    image: options.retina.cssImageRef
                },
                retina_groups: _.values(grouppedSources).map(function (sprite, i) {
                    return {
                        name: sprite.apiName,
                        index: i
                    };
                })
            };

            var apiCode = spritesheetTemplater(
                spritesheetTemplatesData,
                options.spritesheetTemplatesOptions
            );

            async.parallel([
                writeFileR.bind(null, options.target.css, apiCode),
                writeFileR.bind(null, options.target.image, results[0].image, 'binary'),
                writeFileR.bind(null, options.retina.targetImage, results[1].image, 'binary'),
            ], callback)
        }
    ], function (err) {
        if (err) {
            metaOutput.errors.push(err);
        }
        callback();
    });

    function getSpritesForSpritesheetTemplates(prefix, field) {
        return _.map(grouppedSources, function (sprite) {
            return {
                name: prefix + sprite.apiName,
                x: sprite[field].x,
                y: sprite[field].y,
                width: sprite[field].width,
                height: sprite[field].height
            };
        });
    }

    function addCoordinates(groups, coordinatesField, coordinates) {
        _.forEach(coordinates, function(coordinates, name) {
            groups[name][coordinatesField] = coordinates;
        });
    }

    function getSpritesmithConfig(field) {
        return _.merge({}, options.spritesmithOptions, {
            src: _.map(grouppedSources, field)
        });
    }

    function collectErrors() {
        var errors = metaOutput.errors = [];
        _.forEach(grouppedSources, function (group, name) {
            if (group.retina && !group.normal) {
                errors.push(new Error(
                    'webpack-spritesmith: no normal source for sprite "' + name +
                    '" expected file name is ' + group.normalName
                ));
            }
            if (!group.retina && group.normal) {
                errors.push(new Error(
                    'webpack-spritesmith: no retina source for sprite "' + name +
                    '" expected file name is ' + group.retinaName
                ));
            }
        });
    }
};
