const Spritesmith = require('spritesmith');
const path = require('path');
const _ = require('lodash');

const substitute = require('./substitute');
const writeCss = require('./writeCss');
const writeFileR = require('./writeFileR');
const sendToPast = require('./sendToPast');
const promiseCall = require('./promiseCall');

module.exports = async (options, metaOutput, isInitial, srcFiles) => {
    const classifiedSources = srcFiles.map(fileName =>
        options.retina.classifier(path.resolve(options.src.cwd, fileName))
    );

    const grouppedSources = {};
    classifiedSources.forEach(source => {
        const name = options.apiOptions.generateSpriteName(source.normalName);
        if (!(name in grouppedSources)) {
            grouppedSources[name] = {
                apiName: name,
                normalName: source.normalName,
                retinaName: source.retinaName
            };
        }
        grouppedSources[name][source.type] = true;
    });

    collectErrors();

    if (metaOutput.errors.length !== 0) {
        return null;
    }

    const groupByNormalName = _.keyBy(grouppedSources, 'normalName');
    const groupByRetinaName = _.keyBy(grouppedSources, 'retinaName');

    const normalSpritesmithConfig = getSpritesmithConfig('normalName');
    const retinaSpritesmithConfig = getSpritesmithConfig('retinaName');
    retinaSpritesmithConfig.padding = (normalSpritesmithConfig.padding || 0) * 2;

    const results = await Promise.all([
        promiseCall(Spritesmith.run.bind(Spritesmith), normalSpritesmithConfig),
        promiseCall(Spritesmith.run.bind(Spritesmith), retinaSpritesmithConfig)
    ]);

    addCoordinates(groupByNormalName, 'normalCoordinates', results[0].coordinates);
    addCoordinates(groupByRetinaName, 'retinaCoordinates', results[1].coordinates);

    const normalSprites = getSpritesForSpritesheetTemplates('', 'normalCoordinates');
    const retinaSprites = getSpritesForSpritesheetTemplates('retina_', 'retinaCoordinates');

    const spritesheetTemplatesData = {
        sprites: normalSprites,
        spritesheet: {
            width: results[0].properties.width,
            height: results[0].properties.height,
            image: substitute(options.apiOptions.cssImageRef, results[0])
        },
        retina_sprites: retinaSprites,
        retina_spritesheet: {
            width: results[1].properties.width,
            height: results[1].properties.height,
            image: substitute(options.retina.cssImageRef, results[1])
        },
        retina_groups: _.values(grouppedSources).map((sprite, i) => ({
            name: sprite.apiName,
            index: i
        }))
    };

    const normalImageName = substitute(options.target.image, results[0]);
    const retinaImageName = substitute(options.retina.targetImage, results[1]);


    const writeImage = async (fileName, buffer, isInitial) => {
        await writeFileR(fileName, buffer, 'binary');
        await sendToPast(fileName, !isInitial);
    };

    const willWriteCss = writeCss(options.target.css, spritesheetTemplatesData, isInitial);
    await writeImage(normalImageName, results[0].image, isInitial);
    await writeImage(retinaImageName, results[1].image, isInitial);

    return {
        css: await willWriteCss,
        images: [normalImageName, retinaImageName]
    };


    function getSpritesForSpritesheetTemplates(prefix, field) {
        return _.map(grouppedSources, (sprite) => ({
            name: prefix + sprite.apiName,
            x: sprite[field].x,
            y: sprite[field].y,
            width: sprite[field].width,
            height: sprite[field].height
        }));
    }

    function addCoordinates(groups, coordinatesField, coordinates) {
        _.forEach(coordinates, (coordinates, name) => {
            groups[name][coordinatesField] = coordinates;
        });
    }

    function getSpritesmithConfig(field) {
        return _.merge({}, options.spritesmithOptions, {
            src: _.map(grouppedSources, field)
        });
    }

    function collectErrors() {
        const errors = metaOutput.errors = [];
        _.forEach(grouppedSources, (group, name) => {
            if (group.retina && !group.normal) {
                errors.push(new Error(
                    'webpack-spritesmith: no normal source for sprite "' + name +
                    '" expected file name is ' + group.normalName
                ));
            }
            if (!group.retina && group.normal) {
                errors.push(new Error(
                    'webpack-spritesmith: no retina source for sprite "' + name +
                    '" expected file name is ' + group.retinaName
                ));
            }
        });
    }
};
