"use strict";

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const path = require('path');

const gaze = require('gaze');

const fs = require('mz/fs');

const _require = require('./utils'),
      promiseCall = _require.promiseCall;

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

  getWatcher(cb) {
    if (this._watcher) {
      cb && cb(undefined, this._watcher);
    } else {
      this._watcher = gaze(this.options.src.glob, _objectSpread({}, this.options.src.options, {
        cwd: this.options.src.cwd
      }), (err, watcher) => {
        watcher.on('end', () => {
          this._watcher = null;
        });
        cb && cb(err, watcher);
      });
    }

    return this._watcher;
  }

  apply(compiler) {
    this.compilerContext = compiler.options.context;

    this._hook(compiler, 'run', 'run', (compiler, cb) => {
      this.compile(() => {
        // without closing the gaze instance, the build will never finish
        this.getWatcher().close();
        cb();
      });
    });

    let watchStarted = false;

    this._hook(compiler, 'watch-run', 'watchRun', (watching, watchRunCallback) => {
      this.isInitial = !watchStarted;

      if (watchStarted) {
        return watchRunCallback();
      }

      watchStarted = true;
      this.getWatcher((err, watcher) => {
        err && watchRunCallback(err);
        watcher.on('all', () => {
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

      const sourceImagesByFolder = _this.getWatcher().watched(),
            allSourceImages = Object.values(sourceImagesByFolder).reduce((allFiles, files) => [...allFiles, ...files], []),
            sourceImageBySpriteName = allSourceImages.reduce((sourceImageBySpriteName, sourceImage) => {
        const spriteName = _this.options.apiOptions.generateSpriteName(sourceImage);

        if (sourceImageBySpriteName[spriteName]) {
          if (_this.options.logCreatedFiles) {
            console.warn(`Sprite name collision for '${spriteName}': discarding ${sourceImageBySpriteName[spriteName]}, using ${sourceImage}`);
          }
        }

        sourceImageBySpriteName[spriteName] = sourceImage;
        return sourceImageBySpriteName;
      }, {}),
            sourceImages = Object.values(sourceImageBySpriteName);

      const compiledFilesPaths = yield compileStrategy(_this.options, _this.metaOutput, _this.isInitial, sourceImages);
      if (!compiledFilesPaths) return;

      if (_this.options.logCreatedFiles) {
        _this.logCompiledFiles(compiledFilesPaths);
      }

      const jobs = [];

      if (_this.prevCompiledFilePaths) {
        _this.prevCompiledFilePaths.css.forEach(prevCss => {
          if (!compiledFilesPaths.css.includes(prevCss)) {
            jobs.push(fs.unlink(prevCss));
          }
        });

        _this.prevCompiledFilePaths.images.forEach(prevImgPath => {
          if (!compiledFilesPaths.images.includes(prevImgPath)) {
            jobs.push(fs.unlink(prevImgPath));
          }
        });
      }

      _this.prevCompiledFilePaths = compiledFilesPaths;
      yield Promise.all(jobs);
    })();
  }

  logCompiledFiles(compiledFilesPaths) {
    console.log('webpack-spritesmith generated files');
    console.log('images:');
    console.log(compiledFilesPaths.images.map(x => '  ' + path.relative(this.compilerContext, x)).join('\n'));
    console.log('api:');
    console.log(compiledFilesPaths.css.map(x => '  ' + path.relative(this.compilerContext, x)).join('\n'));
  }

  compile(compileCallback) {
    this._compile().then(compileCallback, err => {
      console.log(err);
      this.metaOutput.errors.push(err);
      compileCallback();
    });
  }

};