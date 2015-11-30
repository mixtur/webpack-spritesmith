var spritesheetTemplater = require('spritesheet-templates');
var spritesmith = require('spritesmith');
var gaze = require('gaze');
var glob = require('glob');
var async = require('async');
var mkdirp = require('mkdirp');
var _ = require('lodash');
var path = require('path');
var fs = require('fs');

var processOptions = require('./processOptions');

function SpritesmithPlugin(options) {
    this.options = processOptions(options);
}

function fThrow(x) { throw x; }

SpritesmithPlugin.prototype = {
    apply: function (compiler) {
        compiler.plugin('run', function (compiler, callback) {
            return this.compile(callback);
        }.bind(this));

        var watchStarted = false;
        compiler.plugin('watch-run', function (watcher, watchRunCallback) {
            if (watchStarted) {
                return watchRunCallback();
            }
            watchStarted = true;
            gaze(
                this.options.src.glob,
                {cwd: this.options.src.cwd},
                function (err, gaze) {
                    err && fThrow(err);
                    gaze.on('all', function () {
                        this.compile(function () {});
                    }.bind(this));
                }.bind(this)
            );
            return this.compile(watchRunCallback);
        }.bind(this));
    },
    compile: function (compileCallback) {
        async.waterfall([
            glob.bind(null, this.options.src.glob, {cwd: this.options.src.cwd}),
            function (fileNames, callback) {
                callback(null, _.extend({
                    src: fileNames.map(function (filename) {
                        return path.resolve(this.options.src.cwd, filename);
                    }.bind(this))
                }, this.options.spritesmithOptions));
            }.bind(this),
            spritesmith,
            function (spritesmithResult, callback) {
                async.series([
                    mkdirp.bind(null, path.dirname(this.options.target.image)),
                    async.parallel.bind(async, [
                        this.writeCSS.bind(this, spritesmithResult),
                        this.writeImage.bind(this, spritesmithResult)
                    ])
                ], callback);
            }.bind(this)
        ], compileCallback);
    },
    writeCSS: function (spritesmithResult, callback) {
        var templaterData = this.convertSpritesmithResultToSpritesheetTemplatesFormat(spritesmithResult);
        var code = spritesheetTemplater(templaterData, this.options.spritesheetTemplatesOptions);
        fs.writeFile(
            this.options.target.css,
            code,
            callback
        );
    },
    convertSpritesmithResultToSpritesheetTemplatesFormat: function (spritesmithResult) {
        var generateSpriteName = this.options.apiOptions.generateSpriteName || function (fileName) {
            return path.parse(path.relative(this.options.src.cwd, fileName)).name;
        }.bind(this);
        var sprites = _.map(
            spritesmithResult.coordinates,
            function (oneSourceInfo, fileName) {
                return _.extend(
                    {name: generateSpriteName(fileName)},
                    oneSourceInfo
                );
            }.bind(this)
        );
        var spritesheet = _.extend(
            {image: this.options.apiOptions.cssImageRef || this.options.target.image},
            spritesmithResult.properties
        );

        return {
            sprites: sprites,
            spritesheet: spritesheet
        };
    },
    writeImage: function (spritesmithResult, callback) {
        fs.writeFile(
            this.options.target.image,
            spritesmithResult.image,
            'binary',
            callback
        );
    }
};

module.exports = SpritesmithPlugin;
