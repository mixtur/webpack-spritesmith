const path = require('path');
const gaze = require('gaze');
const glob = require('glob');
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

    apply(compiler) {
        this.compilerContext = compiler.options.context;

        this._hook(compiler, 'run', 'run',
            (compiler, cb) => this.compile(cb)
        );

        let watchStarted = false;
        this._hook(compiler, 'watch-run', 'watchRun', (watching, watchRunCallback) => {
            this.isInitial = !watchStarted;
            if (watchStarted) {
                return watchRunCallback();
            }
            watchStarted = true;
            gaze(
                this.options.src.glob,
                {cwd: this.options.src.cwd},
                (err, gaze) => {
                    err && watchRunCallback(err);
                    gaze.on('all', () => {
                        this.compile(() => {});
                    });
                }
            );

            return this.compile(watchRunCallback);
        });

        this._hook(compiler, 'emit', 'emit', (compilation, cb) => {
            compilation.errors = compilation.errors.concat(this.metaOutput.errors);
            compilation.warnings = compilation.warnings.concat(this.metaOutput.warnings);
            cb();
        });
    }

    async _compile() {
        const src = this.options.src;
        const compileStrategy = this.useRetinaTemplate
            ? require('./compileRetina')
            : require('./compileNormal');

        const sourceImages = await promiseCall(glob, src.glob, {cwd: src.cwd});

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
