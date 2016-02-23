var gaze = require('gaze');
var glob = require('glob');
var async = require('async');

var processOptions = require('./processOptions');
var compileNormal = require('./compileNormal');

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
        var src = this.options.src;
        async.waterfall([
            glob.bind(null, src.glob, {cwd: src.cwd}),
            compileNormal.bind(null, this.options)
        ], compileCallback);
    }
};

module.exports = SpritesmithPlugin;
