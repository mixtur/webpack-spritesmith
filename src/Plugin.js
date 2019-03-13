const path = require('path');
const gaze = require('gaze');
const fs = require('mz/fs');
const {promiseCall} = require('./utils');

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
            this._watcher = gaze(
                this.options.src.glob,
                {
                    ...this.options.src.options,
                    cwd: this.options.src.cwd
                },
                (err, watcher) => {
                    watcher.on('end', () => {
                        this._watcher = null;
                    })
                    cb && cb(err, watcher);
                }
            );
        }
        return this._watcher;
    }

    apply(compiler) {
        this.compilerContext = compiler.options.context;

        this._hook(compiler, 'run', 'run',
            (compiler, cb) => {
                this.compile(() => {
                    // without closing the gaze instance, the build will never finish
                    this.getWatcher().close();
                    cb();
                });
            }
        );

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
            compilation.errors = compilation.errors.concat(this.metaOutput.errors.map(x => 'webpack-spritesmith: ' + x));
            compilation.warnings = compilation.warnings.concat(this.metaOutput.warnings.map(x => 'webpack-spritesmith: ' + x));
            cb();
        });
    }

    async _compile() {
        const compileStrategy = this.useRetinaTemplate ? require('./compileRetina') : require('./compileNormal');
        const sourceImagesByFolder = this.getWatcher().watched();
        const allSourceImages = Object.values(sourceImagesByFolder).reduce(toAllSourceImages, []);
        const sourceImageBySpriteName = allSourceImages.reduce(toSourceImageBySpriteName.bind(this), {});
        const sourceImages = Object.values(sourceImageBySpriteName);

        const compiledFilesPaths = await compileStrategy(
            this.options,
            this.metaOutput,
            this.isInitial,
            sourceImages
        );

        if (!compiledFilesPaths) return;

        if (this.options.logCreatedFiles) {
            this.logCompiledFiles(compiledFilesPaths);
        }

        const jobs = [];
        if (this.prevCompiledFilePaths) {
            this.prevCompiledFilePaths.css.forEach((prevCss) => {
                if (!compiledFilesPaths.css.includes(prevCss)) {
                    jobs.push(fs.unlink(prevCss));
                }
            });
            this.prevCompiledFilePaths.images.forEach((prevImgPath) => {
                if (!compiledFilesPaths.images.includes(prevImgPath)) {
                    jobs.push(fs.unlink(prevImgPath));
                }
            });
        }

        this.prevCompiledFilePaths = compiledFilesPaths;
        await Promise.all(jobs);

        function toAllSourceImages(allFiles, files) {
            let filteredFiles = files.filter((file) => file[file.length-1] !== '/');
            return [...allFiles, ...filteredFiles];
          }
    
        function toSourceImageBySpriteName (sourceImageBySpriteName, sourceImage) {
            const spriteName = this.options.apiOptions.generateSpriteName(sourceImage);
            if (sourceImageBySpriteName[spriteName]) {
                if (this.options.logCreatedFiles) {
                const shortOldFile = path.relative(this.compilerContext, sourceImageBySpriteName[spriteName]);
                const shortReplacedFile = path.relative(this.compilerContext, sourceImage);
        
                this.metaOutput.warnings.push(`Sprite name collision for '${spriteName}': discarding '${shortOldFile}', using '${shortReplacedFile}'`);
                }
            }
            sourceImageBySpriteName[spriteName] = sourceImage;
            return sourceImageBySpriteName;
        };
    }

    logCompiledFiles(compiledFilesPaths) {
        console.log('webpack-spritesmith generated files');
        console.log('images:');
        console.log(
            compiledFilesPaths
                .images
                .map(x => '  ' + path.relative(this.compilerContext, x))
                .join('\n')
        );

        console.log('api:');
        console.log(
            compiledFilesPaths
                .css
                .map(x => '  ' + path.relative(this.compilerContext, x))
                .join('\n')
        );
    }

    compile(compileCallback) {
        this._compile().then(
            compileCallback,
            (err) => {
                console.log(err);
                this.metaOutput.errors.push(err);
                compileCallback();
            }
        );
    }
};
