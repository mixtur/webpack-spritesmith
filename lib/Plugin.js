'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const gaze = require('gaze');
const glob = require('glob');
const fs = require('mz/fs');
const promiseCall = require('./promiseCall');

const processOptions = require('./processOptions');

module.exports = class SpritesmithPlugin {
    constructor(options) {
        this.options = processOptions(options);
        this.useRetinaTemplate = 'retina' in this.options;
        this.cleanMetaOutput();
    }

    cleanMetaOutput() {
        this.metaOutput = {
            warnings: [],
            errors: []
        };
    }

    _hook(compiler, v3Name, v4Name, cb) {
        if (compiler.hooks && compiler.hooks[v4Name]) {
            compiler.hooks[v4Name].tapAsync('webpack-spritesmith', cb);
        } else {
            compiler.plugin(v3Name, cb);
        }
    }

    apply(compiler) {
        this._hook(compiler, 'run', 'run', (compiler, cb) => this.compile(cb));

        let watchStarted = false;
        this._hook(compiler, 'watch-run', 'watchRun', (watching, watchRunCallback) => {
            this.isInitial = !watchStarted;
            if (watchStarted) {
                return watchRunCallback();
            }
            watchStarted = true;
            gaze(this.options.src.glob, { cwd: this.options.src.cwd }, (err, gaze) => {
                err && watchRunCallback(err);
                gaze.on('all', () => {
                    this.compile(() => {});
                });
            });

            return this.compile(watchRunCallback);
        });

        this._hook(compiler, 'emit', 'emit', (compilation, cb) => {
            compilation.errors = compilation.errors.concat(this.metaOutput.errors);
            compilation.warnings = compilation.warnings.concat(this.metaOutput.warnings);
            cb();
        });
    }

    _compile() {
        var _this = this;

        return _asyncToGenerator(function* () {
            const src = _this.options.src;
            const compileStrategy = _this.useRetinaTemplate ? require('./compileRetina') : require('./compileNormal');

            const sourceImages = yield promiseCall(glob, src.glob, { cwd: src.cwd });

            const compiledFilesPaths = yield compileStrategy(_this.options, _this.metaOutput, _this.isInitial, sourceImages);

            if (!compiledFilesPaths) return;

            const jobs = [];
            if (_this.prevCompiledFilePaths) {
                _this.prevCompiledFilePaths.css.forEach(function (prevCss) {
                    if (!compiledFilesPaths.css.includes(prevCss)) {
                        jobs.push(fs.unlink(prevCss));
                    }
                });
                _this.prevCompiledFilePaths.images.forEach(function (prevImgPath) {
                    if (!compiledFilesPaths.images.includes(prevImgPath)) {
                        jobs.push(fs.unlink(prevImgPath));
                    }
                });
            }
            _this.prevCompiledFilePaths = compiledFilesPaths;
            yield Promise.all(jobs);
        })();
    }

    compile(compileCallback) {
        this._compile().then(compileCallback, err => {
            this.metaOutput.errors.push(err);
            compileCallback();
        });
    }
};