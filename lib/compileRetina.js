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

    async.waterfall([
        async.parallel.bind(async, [
            Spritesmith.run.bind(Spritesmith, getSpritesmithConfig('normalName')),
            Spritesmith.run.bind(Spritesmith, getSpritesmithConfig('retinaName'))
        ]),
        function (results, callback) {
            console.log(results);
            callback();
        }
    ], callback);

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
