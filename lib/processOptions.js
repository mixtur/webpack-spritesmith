var _ = require('lodash');
var path = require('path');
var fs = require('fs');
var templater = require('spritesheet-templates');

function fThrowExpectField(f) { throw 'Expected field"' + f + '" in options of SpritesmithPlugin' }

module.exports = function (rawOptions) {
    rawOptions.src || fThrowExpectField('src');
    rawOptions.src.cwd || fThrowExpectField('src.cwd');
    rawOptions.src.glob || fThrowExpectField('src.glob');
    rawOptions.target || fThrowExpectField('target');
    rawOptions.target.css || fThrowExpectField('target.css');
    rawOptions.target.image || fThrowExpectField('target.image');

    var mergedOptions = _.merge({}, {
        apiOptions: {
            generateSpriteName: function (fileName) {
                return path.parse(path.relative(mergedOptions.src.cwd, fileName)).name;
            },
            cssImageRef: rawOptions.target.image,
            customTemplates: {}
        },
        spritesmithOptions: {},
        spritesheetTemplatesOptions: {}
    }, rawOptions);

    normalizeTargetCss(mergedOptions);

    mergedOptions.target.css.forEach(function (css, i) {
        if (!css[1].format) {
            throw 'SpritesmithPlugin was unable to derive ' +
            'css format from extension "' + path.parse(css[0] || '').ext + '" ' +
            'in "target.css[' + i + ']" and format was not specified explicitly';
        }
    });

    _.forEach(mergedOptions.customTemplates, function (template, templateName) {
        if (typeof template === 'string') {
            templater.addHandlebarsTemplate(templateName, fs.readFileSync(template, 'utf-8'));
        } else if (typeof template === 'function') {
            templater.addTemplate(templateName, template);
        } else {
            throw new Error('custom template can be either path/to/handlebars/template or actual template function');
        }
    });

    processRetinaOptions(mergedOptions);

    return mergedOptions;
};

function normalizeTargetCss(mergedOptions) {
    var css = mergedOptions.target.css;

    if (!(css instanceof Array)) {
        css = [[css, mergedOptions.spritesheetTemplatesOptions]];
    }

    mergedOptions.target.css = css.map(normalizeOne);

    function normalizeOne(css, i) {
        if (typeof css === 'string') {
            return [css, {
                format: extractFormatFromCSSFilename(css)
            }];
        } else if (css instanceof Array) {
            var cssCopy = css.slice(0);
            if (cssCopy.length < 2) {
                cssCopy[1] = {};
            }
            if (!('format' in cssCopy[1])) {
                cssCopy[1].format = extractFormatFromCSSFilename(cssCopy[0]);
            }
            return cssCopy;
        } else {
            throw new Error('target.css[' + i + '] must be String or Array');
        }
    }
}

var extensionToCssFormat = {
    '.stylus': 'stylus',
    '.styl': 'stylus',
    '.sass': 'sass',
    '.scss': 'scss',
    '.less': 'less',
    '.json': 'json',
    '.css': 'css'
};

function extractFormatFromCSSFilename(cssFileName) {
    return extensionToCssFormat[path.parse(cssFileName).ext];
}

function processRetinaOptions(options) {
    if (!('retina' in options)) {
        return;
    }

    if (typeof options.retina === 'string') {
        var suffix = options.retina;
        var r = options.retina = {
            classifier: suffixToClassifier(suffix)
        };

        r.targetImage = r.targetImage || addSuffixToFileName(suffix, options.target.image, path);
        r.cssImageRef = r.cssImageRef || addSuffixToFileName(suffix, options.apiOptions.cssImageRef, path.posix);
    } else {
        options.retina.classifier || fThrowExpectField('retina.classifier');
        options.retina.targetImage || fThrowExpectField('retina.targetImage');
        options.retina.cssImageRef || fThrowExpectField('retina.cssImageRef');
    }

    options.target.css.forEach(function (css) {
        css[1].format += '_retina';
    });
}

function suffixToClassifier(suffix) {
    return function (fileName) {
        var parsed = splitExt(fileName);
        if (hasSuffix(suffix, parsed.name)) {
            return {
                type: 'retina',
                retinaName: fileName,
                normalName: parsed.name.slice(0, -suffix.length) + parsed.ext
            };
        }
        return {
            type: 'normal',
            retinaName: parsed.name + suffix + parsed.ext,
            normalName: fileName
        };
    };
}

function hasSuffix(suffix, str) {
    return str.slice(-suffix.length) === suffix;
}

function splitExt(fileName) {
    var extInd = fileName.lastIndexOf('.');
    var ext = fileName.slice(extInd);
    var name = fileName.slice(0, extInd);
    return {
        name: name,
        ext: ext
    };
}

function addSuffixToFileName(suffix, fileName, pathImpl) {
    var parsed = pathImpl.parse(fileName);
    parsed.name += suffix;
    parsed.base = parsed.name + parsed.ext;
    return pathImpl.format(parsed);
}

