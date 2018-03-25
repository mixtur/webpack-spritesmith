var gaze = require('gaze');
var glob = require('glob');
var async = require('async');
var fs = require('fs');

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

    _hook: function (compiler, v3Name, v4Name, fn) {
        if (compiler.hooks && compiler.hooks[v4Name]) {
            compiler.hooks[v4Name].tapAsync('webpack-spritesmith', fn);
        } else {
            compiler.plugin(v3Name, fn);
        }
    },

    apply: function (compiler) {
        this._hook(compiler, 'run', 'run', function (compiler, callback) {
            return this.compile(callback);
        }.bind(this));

        var watchStarted = false;
        this._hook(compiler, 'watch-run', 'watchRun', function (watching, watchRunCallback) {
            this.isInitial = !watchStarted;
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

        this._hook(compiler, 'emit', 'emit', function (compilation, callback) {
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
            compileStrategy.bind(null, this.options, this.metaOutput, this.isInitial),
            function (compiledFilesPaths, callback) {
                if (!compiledFilesPaths) {
                    return callback();
                }
                if (this.prevCompiledFilePaths) {
                    const jobs = [];
                    this.prevCompiledFilePaths.css.forEach(function (prevCss) {
                        if (!compiledFilesPaths.css.includes(prevCss)) {
                            jobs.push(fs.unlink.bind(fs, prevCss));
                        }
                    });
                    this.prevCompiledFilePaths.images.forEach(function (prevImgPath) {
                        if (!compiledFilesPaths.images.includes(prevImgPath)) {
                            jobs.push(fs.unlink.bind(fs, prevImgPath));
                        }
                    });
                    this.prevCompiledFilePaths = compiledFilesPaths;
                    async.parallel(jobs, callback);
                } else {
                    this.prevCompiledFilePaths = compiledFilesPaths;
                    callback();
                }
            }.bind(this)
        ], compileCallback);
    }
};

module.exports = SpritesmithPlugin;
