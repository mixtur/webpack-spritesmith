const Spritesmith = require('spritesmith');
const path = require('path');
const _ = require('lodash');

const substitute = require('./substitute');
const writeCss = require('./writeCss');
const {sendToPast, promiseCall, writeFileR} = require('./utils');

module.exports = async (options, metaOutput, isInitial, srcFiles) => {
    const sourceRecords = srcFiles.map(fileName => {
        const oneRecord = options.retina.classifier(path.resolve(options.src.cwd, fileName));
        return {
            ...oneRecord,
            apiName: options.apiOptions.generateSpriteName(oneRecord.normalName)
        };
    });

    const combinedSources = _.map(
        _.groupBy(sourceRecords, 'apiName'),
        (group) => {
            const result = _.clone(group[0]);
            group.forEach(oneRecord => {
                result[oneRecord.type] = true;
            });
            return result;
        }
    );

    const errors = checkMissingImages();
    if (errors.length !== 0) {
        metaOutput.errors.push(...errors);
        return null;
    }

    const results = await Promise.all([
        promiseCall(Spritesmith.run.bind(Spritesmith), {
            ...options.spritesmithOptions,
            src: _.map(combinedSources, 'normalName')
        }),
        promiseCall(Spritesmith.run.bind(Spritesmith), {
            ...options.spritesmithOptions,
            src: _.map(combinedSources, 'retinaName'),
            padding: (options.padding || 0) * 2
        })
    ]);

    combinedSources.forEach(oneSource => {
        oneSource.normalCoordinates = results[0].coordinates[oneSource.normalName];
        oneSource.retinaCoordinates = results[1].coordinates[oneSource.retinaName];
    });

    const normalSprites = getSpritesForSpritesheetTemplates('', 'normalCoordinates', 'normalName');
    const retinaSprites = getSpritesForSpritesheetTemplates('retina_', 'retinaCoordinates', 'retinaName');

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
        retina_groups: combinedSources.map((sprite, i) => ({
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

    function getSpritesForSpritesheetTemplates(prefix, field, sourceField) {
        return _.map(combinedSources, (sprite) => ({
            name: prefix + sprite.apiName,
            source_image: sprite[sourceField],
            x: sprite[field].x,
            y: sprite[field].y,
            width: sprite[field].width,
            height: sprite[field].height
        }));
    }

    function checkMissingImages() {
        const errors = [];
        _.forEach(combinedSources, (group) => {
            if (group.retina && !group.normal) {
                errors.push(new Error(
                    'webpack-spritesmith: no normal source for sprite "' + group.apiName +
                    '" expected file name is ' + group.normalName
                ));
            }
            if (!group.retina && group.normal) {
                errors.push(new Error(
                    'webpack-spritesmith: no retina source for sprite "' + group.apiName +
                    '" expected file name is ' + group.retinaName
                ));
            }
        });
        return errors;
    }
};
