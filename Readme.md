Braindead webpack plugin that converts set of images into a spritesheet and SASS/LESS/Stylus mixins, using [spritesmith](https://github.com/Ensighten/spritesmith) and [spritesheet-templates](https://github.com/twolfson/spritesheet-templates) 

All ideas are shamelessly taken from [gulp.spritesmith](https://github.com/twolfson/gulp.spritesmith).

###Example

Let's say you have following folder structure

```
/
|-src
| |-ico
| | |-new.png
| | |-open.png
| | |-save.png
| | ...
| |-style.styl
| ...
|-webpack.config.js

```

Then you need to instantiate plugin in webpack config like this:

```javascript

//webpack.config.js
var path = require('path');

var SpritesmithPlugin = require('webpack-spritesmith');

module.exports = {
    // ...
    resolve: {
        modulesDirectories: ["web_modules", "node_modules", "spritesmith-generated"]
    },
    plugins: [
        new SpritesmithPlugin({
            src: {
                cwd: path.resolve(__dirname, 'src/ico'),
                glob: '*.png'
            },
            target: {
                image: path.resolve(__dirname, 'src/spritesmith-generated/sprite.png'),
                css: path.resolve(__dirname, 'src/spritesmith-generated/sprite.styl')
            }
        })
    ]
    // ...
};


```

And then just use it


```stylus

//style.styl
@import '~sprite.styl'

.close-button
    sprite($close)
.open-button
    sprite($open)

```

###Options

- `src` - used to build list of source png images
    - `cwd` should be the closest common directory for all source images;
    - `glob` well... it is a glob

    `cwd` and `glob` both will be passed directly to [glob](https://github.com/isaacs/node-glob) (and [gaze](https://github.com/shama/gaze) in watch mode), then results will be used as list of source images

- `target` - generated files
    - `image` - target image filename
    - `css` - target spritesheet filename, can be css, stylus, less or sass file
- `spritesmithOptions` - optional. Options for [spritesmith](https://github.com/Ensighten/spritesmith)
- `spritesheetTemplatesOptions` - optional. Options for [spritesheet-templates](https://github.com/twolfson/spritesheet-templates)
    
`spritesheetTemplatesOptions.format` - usually derived from file extension in `target.css`, but can be specified explicitly
