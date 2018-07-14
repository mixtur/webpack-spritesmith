const spritesheetTemplater = require('spritesheet-templates');
const {sendToPast, writeFileR} = require('./utils');

module.exports = async (sources, templaterData, shouldSendToPast) => {
    return await Promise.all(sources.map(async css => {
        const fileName = css[0];

        const code = spritesheetTemplater(templaterData, css[1]);

        await writeFileR(fileName, code);
        await sendToPast(fileName, !shouldSendToPast);

        return fileName;
    }));
};
