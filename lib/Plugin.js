var gaze = require('gaze');
var glob = require('glob');
var async = require('async');

var processOptions = require('./processOptions');

function SpritesmithPlugin(options) {
    this.options = processOptions(options);
    this.useRetinaTemplates = 'retina' in this.options;
    this.cleanMetaOutput();
}

function fThrow(x) { throw x; }

SpritesmithPlugin.prototype = {
    cleanMetaOutput: function () {
        this.metaOutput = {
            warnings: [],
            errors: []
        };
    },
    apply: function (compiler) {
        compiler.plugin('run', function (compiler, callback) {
            return this.compile(callback);
        }.bind(this));

        var watchStarted = false;
        compiler.plugin('watch-run', function (watching, watchRunCallback) {
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

        compiler.plugin('emit', function (compilation, callback) {
            compilation.errors = compilation.errors.concat(this.metaOutput.errors);
            compilation.warnings = compilation.warnings.concat(this.metaOutput.warnings);
            callback();
        }.bind(this));
    },
    compile: function (compileCallback) {
        var src = this.options.src;

        var compileStrategy = this.useRetinaTemplates
            ? require('./compileRetina')
            : require('./compileNormal');

        async.waterfall([
            glob.bind(null, src.glob, {cwd: src.cwd}),
            compileStrategy.bind(null, this.options, this.metaOutput)
        ], compileCallback);
    }
};

module.exports = SpritesmithPlugin;
