const _ = require('lodash');
const path = require('path');
const fs = require('fs');
const templater = require('spritesheet-templates');

const fThrowExpectField = () => { throw 'Expected field"' + f + '" in options of SpritesmithPlugin'; };

module.exports = (rawOptions) => {
    rawOptions.src || fThrowExpectField('src');
    rawOptions.src.cwd || fThrowExpectField('src.cwd');
    rawOptions.src.glob || fThrowExpectField('src.glob');
    rawOptions.target || fThrowExpectField('target');
    rawOptions.target.css || fThrowExpectField('target.css');
    rawOptions.target.image || fThrowExpectField('target.image');

    const mergedOptions = _.merge(
        {
            apiOptions: {
                generateSpriteName: (fileName) =>
                    path.parse(path.relative(mergedOptions.src.cwd, fileName)).name,
                cssImageRef: rawOptions.target.image,
                customTemplates: {},
                handlebarsHelpers: {}
            },
            spritesmithOptions: {},
            spritesheetTemplatesOptions: {}
        },
        rawOptions
    );

    mergedOptions.target.css = normalizeTargetCss(mergedOptions);

    mergedOptions.target.css.forEach((css, i) => {
        if (!css[1].format) {
            throw 'SpritesmithPlugin was unable to derive ' +
            `css format from extension "${path.parse(css[0] || '').ext }" ` +
            `in "target.css[${i}]" and format was not specified explicitly`;
        }
    });

    _.forEach(mergedOptions.customTemplates, (template, templateName) => {
        if (typeof template === 'string') {
            templater.addHandlebarsTemplate(templateName, fs.readFileSync(template, 'utf-8'));
        } else if (typeof template === 'function') {
            templater.addTemplate(templateName, template);
        } else {
            throw new Error('custom template can be either path/to/handlebars/template or actual template function');
        }
    });

    const handlebarsHelpers = mergedOptions.apiOptions.handlebarsHelpers;
    Object.keys(handlebarsHelpers).forEach((helperKey) => {
        templater.registerHandlebarsHelper(helperKey, handlebarsHelpers[helperKey]);
    });

    processRetinaOptions(mergedOptions);

    return mergedOptions;
};

const normalizeTargetCss = (mergedOptions) => {
    let css = mergedOptions.target.css;

    if (!Array.isArray(css)) {
        css = [[css, mergedOptions.spritesheetTemplatesOptions]];
    }

    return css.map((css, i) => {
        if (typeof css === 'string') {
            return [css, {
                format: extractFormatFromCSSFilename(css)
            }];
        }
        if (Array.isArray(css)) {
            const [cssFileName, options = {}] = css.slice(0);
            const format = options.format || extractFormatFromCSSFilename(cssFileName);
            return [cssFileName, {...options, format}];
        }
        throw new Error(`'target.css[${i}] must be String or Array'`);
    })
};

const extensionToCssFormat = {
    '.stylus': 'stylus',
    '.styl': 'stylus',
    '.sass': 'sass',
    '.scss': 'scss',
    '.less': 'less',
    '.json': 'json',
    '.css': 'css'
};

const extractFormatFromCSSFilename =
    (cssFileName) => extensionToCssFormat[path.parse(cssFileName).ext];

const processRetinaOptions = (options) => {
    if (!('retina' in options)) {
        return;
    }

    if (typeof options.retina === 'string') {
        const suffix = options.retina;
        const r = options.retina = {
            classifier: suffixToClassifier(suffix)
        };

        r.targetImage = addSuffixToFileName(suffix, options.target.image, path);
        r.cssImageRef = addSuffixToFileName(suffix, options.apiOptions.cssImageRef, path.posix);
    } else {
        options.retina.classifier || fThrowExpectField('retina.classifier');
        options.retina.targetImage || fThrowExpectField('retina.targetImage');
        options.retina.cssImageRef || fThrowExpectField('retina.cssImageRef');
    }

    options.target.css.forEach((css) => {
        css[1].format += '_retina';
    });
};

const suffixToClassifier = (suffix) => (fileName) => {
    const parsed = splitExt(fileName);
    if (endsWith(suffix, parsed.name)) {
        return {
            type: 'retina',
            retinaName: fileName,
            normalName: parsed.name.slice(0, -suffix.length) + parsed.ext
        };
    } else {
        return {
            type: 'normal',
            retinaName: parsed.name + suffix + parsed.ext,
            normalName: fileName
        };
    }
};

const endsWith = (suffix, str) => str.slice(-suffix.length) === suffix;

const splitExt = (fileName) => {
    const extInd = fileName.lastIndexOf('.');
    return {
        name: fileName.slice(0, extInd),
        ext: fileName.slice(extInd)
    };
};

const addSuffixToFileName = (suffix, fileName, pathImpl) => {
    const parsed = pathImpl.parse(fileName);
    parsed.name += suffix;
    parsed.base = parsed.name + parsed.ext;
    return pathImpl.format(parsed);
};
