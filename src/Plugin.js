const path = require('path');
const chokidar = require('chokidar');
const fs = require('mz/fs');
const glob = require('glob');

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

    getWatcher() {
        if (!this._watcher) {
            this._watcher = chokidar.watch(
                this.options.src.glob,
                {
                    ...this.options.src.options,
                    cwd: this.options.src.cwd,
                    ignoreInitial: true
                },
            );
        }
        return this._watcher;
    }

    apply(compiler) {
        this.compilerContext = compiler.options.context;

        this._hook(compiler, 'run', 'run',
            (compiler, cb) => {
                this.compile(() => {
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

            this.getWatcher()
                .on('ready', () => {
                    this.compile();
                })
                .on('add', () => {
                    this.compile()
                })
                .on('change', () => {
                    this.compile();
                })
                .on('unlink', () => {
                    this.compile();
                })
                .on("error", (error) => {
                    watchRunCallback(error)
                })

            return this.compile(watchRunCallback);
        });

        this._hook(compiler, 'emit', 'emit', (compilation, cb) => {
            compilation.errors = compilation.errors.concat(this.metaOutput.errors.map(x => 'webpack-spritesmith: ' + x));
            compilation.warnings = compilation.warnings.concat(this.metaOutput.warnings.map(x => 'webpack-spritesmith: ' + x));
            cb();
        });
    }

    async _compile() {
        const compileStrategy = this.useRetinaTemplate
            ? require('./compileRetina')
            : require('./compileNormal');

        const allSourceImages = glob.sync(this.options.src.glob, { cwd: this.options.src.cwd });

        const sourceImageBySpriteName = allSourceImages.reduce((sourceImageBySpriteName, sourceImage) => {
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
        }, {});

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

    compile(compileCallback = null) {
        if (!compileCallback) {
            compileCallback = () => { }
        }
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
