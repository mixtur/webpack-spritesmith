var path = require('path');

var SpritesmithPlugin = require('../lib/Plugin');
require('./customTemplate');

module.exports = {
    entry: path.resolve(__dirname, 'src/entry.js'),

    output: {
        path: path.resolve(__dirname, 'build'),
        filename: 'bundle.js'
    },

    module: {
        loaders: [
            {test: /\.styl$/, loaders: [
                'style',
                'css',
                'stylus'
            ]},
            {test: /\.png$/, loaders: [
                'file?name=i/[hash].[ext]'
            ]}
        ]
    },

    resolve: {
        modulesDirectories: ["web_modules", "node_modules", "generated"]
    },

    plugins: [
        new SpritesmithPlugin({
            src: {
                cwd: path.resolve(__dirname, 'src'),
                glob: '**/ico/*.png'
            },
            target: {
                image: path.resolve(__dirname, 'src/generated/sprite.png'),
                css: [
                    path.resolve(__dirname, 'src/generated/sprite.styl'),
                    path.resolve(__dirname, 'src/generated/sprite.json'),
                    path.resolve(__dirname, 'src/generated/sprite.css'),
                    [path.resolve(__dirname, 'src/generated/sprite-custom.css'), {
                        format: 'custom_format',
                    }]
                ]
            },
            apiOptions: {
                generateSpriteName: function (fileName) {
                    var parsed = path.parse(fileName);
                    var dir = parsed.dir.split(path.sep);
                    var moduleName = dir[dir.length - 2];
                    return moduleName + '__' + parsed.name;
                },
                cssImageRef: '~sprite.png'
            },
            retina: '@2x'
        })
    ]
};
