'use strict';

var fs = require('fs');
var path = require('path');
var events = require('events');
var Readable = require('stream').Readable;
var File = require('vinyl');
var url = require('url2');
var shell = require('shelljs');
var assign = require('object-assign');
var chokidar = require('chokidar');
var glob = require('glob');
var Promise = require('bluebird');
var templater = require('spritesheet-templates');
var spritesmith = require('spritesmith');
var svgicons2svgfont = require('svgicons2svgfont');
var svg2ttf = require('svg2ttf');
var ttf2eot = require('ttf2eot');
var ttf2woff = require('ttf2woff');
var SVGO = require('svgo');
var chalk = require('chalk');

chalk.enabled = true;

function defaultOptions() {
  return {
    dest: 'img/sprites',
    fontDest: 'fonts',
    cssDest: 'css',
    padding: 25,
    algorithm: 'top-down',
    engine: 'pixelsmith',
    sheetDest: 'css',
    sheetFormat: 'css',
    sheetTemplate: true,
    iconfonts: false,
    watch: false
  };
}

function SpritegenSheets(options) {
  this.verifyRequiredProps(options, function(props) {
    this.options = assign({}, defaultOptions(), props);

    this.src = props.src;
    this.dest = this.options.dest;
    this.sheetTemplate = this.options.sheetTemplate;
    this.sheetFormat = this.options.sheetFormat;
    this.basePath = (!!props.cwd) ? path.resolve(props.cwd) : process.cwd();
    this.logger = props.logger || console;
    this.streams = props.streams || false;
  }.bind(this));
}

SpritegenSheets.prototype = new events.EventEmitter;

/**
 * Verify required properties
 * @param {Object} props
 * @param {Function} callback
 */
SpritegenSheets.prototype.verifyRequiredProps = function(props, callback) {
  if (!props.hasOwnProperty('src')) {
    throw new Error('Missing property "src" in SpritegenSheets config');
  }
  else if (!props.hasOwnProperty('dest') && !props.streams) {
    throw new Error('Missing property "dest" in SpritegenSheets config');
  }
  else {
    callback(props);
  }
};

SpritegenSheets.prototype.start = function() {
  var self = this;
  var src = this.src;

  if (this.logger === console) {
    this.logger.log(chalk.bold(
      'Starting SpritegenSheets...\n'
    ));
  }

  if (this.options.watch) {
    var baseDir, ending = '';

    if (this.streams) {
      var sheet = path.dirname(this.src[0]);
      for (var sheet in this.src) {
        self.logger.log('Watching "'+sheet+'" for changes...\n');
      }
    }
    else {
      if (typeof src === 'string') {
        baseDir = path.dirname(src);

        self.logger.log('Watching "'+baseDir+'" for changes...\n');
      }
      else {
        for (var i = 0; i < src.length; i++) {
          baseDir = path.dirname(src[i]);

          if (i === src.length - 1) {
            ending = '\n';
          }

          self.logger.log('Watching "' + baseDir + '" for changes...' + ending);
        }
      }
    }
  }

  if (typeof src === 'string') {

    return self.walkAndGenerate(src).then(function(info) {

      if (self.options.watch) {
        self.watch();
      }

      return info;
    }).catch(self.logger.log);

  }
  else {
    if (!!this.streams) {

      return Promise.all(Object.keys(src)
        .map(function(sheet) {
          return self.walkAndGenerate(src[sheet], sheet).then(function(info) {
            return info;
          }).catch(self.logger.log);
        })
      ).then(function(info) {

        if (self.options.watch) {
          self.watch();
        }

        return info;
      }).catch(self.logger.log);
    }
    else {

      return Promise.all(src
        .map(function(srcPath) {
          return self.walkAndGenerate(srcPath).then(function(info) {
            return info;
          }).catch(self.logger.log);
        })
      ).then(function(info) {

        if (self.options.watch) {
          self.watch();
        }

        return info;
      }).catch(self.logger.log);
    }
  }
};

SpritegenSheets.prototype.watch = function() {
  var self = this;
  var src = this.src;
  var opts = { cwd: this.basePath };

  // if (typeof this.usePolling === 'undefined') {
  //   opts.usePolling = true;
  // }

  if (!!this.streams) {
    var dirs = [];
    src = [];
    opts = {};

    for (var sheet in this.src) {
      this.src[sheet].forEach(function(source) {

        var baseDir = path.dirname(source);
        var extension = path.extname(source);

        var dirExists = dirs.filter(function(item) {
          return item.directory === baseDir;
        });

        if (!dirExists.length) {
          dirs.push({ directory: baseDir, extensions: [] });
        }

        var extExists = dirs.filter(function(item) {
          return item.extensions === baseDir;
        });

        if (!extExists.length) {
          dirs.some(function(item) {
            if (item.directory === baseDir) {
              if (item.extensions.indexOf(extension) === -1) {
                item.extensions.push(extension);
              }
              return true;
            }
          })
        }
      });
    }

    dirs.forEach(function(item) {
      item.extensions.forEach(function(ext) {
        src.push(item.directory + '/*' + ext);
      });
    });
  }

  var watcher = chokidar.watch(src, opts);

  watcher.on('error', function(err) {
    self.logger.log(err);
  });

  watcher.on('ready', function() {
    watcher.on('all', function(event, filepath) {
      if (event === 'add' || event === 'unlink') {
        var src = self.src;
        var relativePath = filepath.replace(self.basePath + '/', '');

        if (typeof src === 'string') {
          self.walkAndGenerate(self.src).catch(self.logger.log);
        }
        else {
          var dirname = path.dirname(filepath);

          if (!!self.streams) {
            for (var sheet in self.src) {
              if (self.src.hasOwnProperty(sheet)) {

                var sources = self.src[sheet];

                sources.some(function(srcpath) {
                  var srcDir = path.dirname(srcpath);

                  if (dirname === srcDir) {
                    if (event === 'add') {
                      if (sources.indexOf(filepath) === -1) {
                        sources.push(filepath);
                        self.src[sheet] = sources;
                      }

                      self.logger.log('%s file %s to %s spritesheet', chalk.yellow('added'), relativePath, sheet);
                    }

                    if (event === 'unlink') {
                      var idx = sources.indexOf(filepath);

                      if (~idx) {
                        sources.splice(idx, 1);
                      }
                      self.src[sheet] = sources;

                      self.logger.log('%s file %s from %s spritesheet', chalk.yellow('removed'), relativePath, sheet);
                    }

                    self.walkAndGenerate(sources, sheet).catch(self.logger.log);
                    return true;
                  }

                  return false;
                });
              }
            }
          }
          else {
            for (var i = 0; i < src.length; i++) {
              var currentSrc = src[i];
              var srcDir = path.dirname(currentSrc);

              if (dirname === srcDir) {
                self.walkAndGenerate(currentSrc).catch(self.logger.log);
              }
            }
          }
        }
      }
    });
  });
};

SpritegenSheets.prototype.glob = function(src) {
  var self = this;

  return new Promise(function(resolve, reject) {
    // if src isn't a string, then an array of
    // filepaths was passed in already so we don't
    // need to expand the glob.
    if (typeof src !== 'string') {
      return resolve(src);
    }

    // Need to return full path to images,
    // otherwise certain cases fail
    if (src.charAt(0) !== '/') {
      src = self.basePath + '/' + src;
    }

    glob(src, function(err, files) {
      if (err) {
        reject(err);
      }
      else {
        resolve(files);
      }
    });
  });
};

SpritegenSheets.prototype.walkAndGenerate = function(src, spriteName) {
  var self = this;
  var baseDir = path.dirname(src);
  var name = spriteName || path.basename(baseDir);

  var spriteInfo = {
    name: name,
    directory: baseDir
  };

  return this.glob(src).then(function(files) {
    var icons = [];
    var images = [];

    if (!self.options.iconfonts) {
      images = files;
    }
    else {
      icons = files.filter(function(file) {
        return ~file.indexOf('.svg');
      });

      images = files.filter(function(file) {
        return file.indexOf('.svg') === -1
      });
    }

    var generateIcons = Promise.resolve();
    var generateSprites = Promise.resolve();

    if (icons.length) {
      generateIcons = self.generateFontSprite(spriteInfo, icons);
    }

    if (images.length) {
      generateSprites = self.generateSprite(spriteInfo, images);
    }

    return Promise.all([
      generateIcons,
      generateSprites
    ]).then(function(info) {
      return info;
    }).catch(self.logger.log);
  }).catch(self.logger.log);
};

SpritegenSheets.prototype.generateSprite = function(spriteInfo, images) {
  var end, start = new Date().getTime();
  var destCss, self = this;
  var destImg, destImgDir = this.dest;
  var spriteSuffix = ~spriteInfo.name.indexOf('sprite') ? '.png' : '-sprite.png';

  if (!!this.streams) {
    destImg = spriteInfo.name + spriteSuffix
  }
  else {
    destImg = destImgDir + '/' + spriteInfo.name + spriteSuffix;
  }

  var spritesmithParams = {
    src: images,
    padding: this.options.padding,
    algorithm: this.options.algorithm,
    engine: this.options.engine
  };

  if (this.sheetTemplate === true) {
    this.sheetTemplate = path.resolve(__dirname, '../templates/compass-compatible.mustache');
  }

  if (!!this.streams) {
    destCss = '_' + spriteInfo.name + '.' + this.sheetFormat;
  }
  else if (this.dest) {
    destCss = this.options.sheetDest + '/_' + spriteInfo.name + '.' + this.sheetFormat;
  }
  else {
    if (!fs.existsSync('css')) {
      shell.mkdir('css');
    }

    destCss = 'css/' + spriteInfo.name + '.' + this.sheetFormat;
  }

  return new Promise(function(resolve, reject) {

    spritesmith(spritesmithParams, function (err, result) {
      if (err) {
        return reject(chalk.red('Error generating sprites: ') + err);
      }

      // Create the image path if doesn't exist
      if (!self.streams && !fs.existsSync(destImgDir)) {
        shell.mkdir(destImgDir);
      }

      var cleanCoords = [], spritesheetInfo;

      // Generate a listing of CSS variables
      var coordinates = result.coordinates;
      var properties = result.properties;
      var spritePath = url.relative(destCss, destImg);
      var spriteFileName = path.basename(destImg);

      spritesheetInfo = {
        width: properties.width,
        height: properties.height,
        image: spritePath,
        container: spriteInfo.name,
        spriteFileName: spriteFileName
      };

      var cssVarMap = function noop () {};

      // Clean up the file name of the file
      Object.getOwnPropertyNames(coordinates).sort().forEach(function(file) {
        // Extract the image name (exlcuding extension)
        var fullname = path.basename(file);
        var nameParts = fullname.split('.');

        // If there is are more than 2 parts, pop the last one
        if (nameParts.length >= 2) {
          nameParts.pop();
        }

        // Extract out our name
        var name = nameParts.join('.');
        var coords = coordinates[file];

        // Specify the image for the sprite
        coords.name = name;
        coords.source_image = file;
        coords.n1 = nameParts[0];
        coords.n2 = nameParts[1];

        // DEV: `image`, `total_width`, `total_height` are deprecated as they are overwritten in `spritesheet-templates`
        coords.image = spritePath;
        coords.total_width = properties.width;
        coords.total_height = properties.height;

        // Map the coordinates through cssVarMap
        coords = cssVarMap(coords) || coords;

        // Save the cleaned name and coordinates
        cleanCoords.push(coords);
      });

      var cssFormat = 'spritesmith-custom';
      var cssOptions = {};

      if (!self.sheetTemplate) {
        // Override the cssFormat
        cssFormat = self.sheetFormat;
      }
      else {
        // If there's a custom template, use it
        if (typeof self.sheetTemplate === 'function') {
          templater.addTemplate(cssFormat, self.sheetTemplate);
        }
        else {
          templater.addMustacheTemplate(cssFormat, fs.readFileSync(self.sheetTemplate, 'utf8'));
        }
      }

      // Render the variables via `spritesheet-templates`
      var cssStr = templater({
        items: cleanCoords,
        spritesheet: spritesheetInfo
      }, {
        format: cssFormat,
        formatOpts: cssOptions,
        spritesheetName: 'spritesheet'
      });

      var destCssDir = path.dirname(destCss);

      if (!!self.streams) {
        var imgStream = new Readable({ objectMode: true });
        var imgStreamFile = new File({
          path: path.basename(destImg),
          contents: new Buffer(result.image, 'binary')
        });
        imgStream.push(imgStreamFile);
        imgStream.push(null);

        var spritesheetStream = new Readable({ objectMode: true });
        var spritesheetStreamFile = new File({
          path: path.basename(destCss),
          contents: new Buffer(cssStr)
        });
        spritesheetStream.push(spritesheetStreamFile);
        spritesheetStream.push(null);

        end = new Date().getTime();

        var streamObj = {
          imgFilename: path.basename(destImg),
          cssFilename: path.basename(destCss),
          img: imgStream,
          css: spritesheetStream,
          time: (end - start) / 1000
        };

        self.emit('update', streamObj);

        return resolve(streamObj);
      }

      // create the sprite
      fs.writeFile(destImg, result.image, 'binary', function(err) {
        if (err) {
          return reject(chalk.red('Error creating sprite: ') + err);
        }

        if (!fs.existsSync(destCssDir)) {
          shell.mkdir(destCssDir);
        }

        // create the sprite stylesheet
        fs.writeFile(destCss, cssStr, 'utf8', function(err) {
          if (err) {
            return reject(chalk.red('Error generating spritesheets: ') + err);
          }

          self.logger.log('Files "' + destCss + '", "' + destImg + '" created.');
          resolve({ coords: cleanCoords, info: spritesheetInfo });
        });
      });
    });

  }.bind(this));
};

SpritegenSheets.prototype.generateFontSprite = function(spriteInfo, icons) {
  var self = this;

  return new Promise(function(resolve, reject) {
    console.log(spriteInfo);
    var destFontDir = self.options.fontDest;
    var destFont = destFontDir + '/' + spriteInfo.name;
    var destCss = self.options.sheetDest + '/_' + spriteInfo.name + '.' + self.sheetFormat;

    self.logger.log('%s icon font %s', chalk.yellow('generating'), spriteInfo.name);

    var fontStream = svgicons2svgfont({
      fontName: spriteInfo.name,
      normalize: true,
      callback: function(glyphs) {

        self.sheetTemplate = path.resolve(__dirname, '../templates/compass-compatible-fonts.mustache');
        templater.addMustacheTemplate('scss', fs.readFileSync(self.sheetTemplate, 'utf8'));

        // Generate a listing of CSS variables
        var spritePath = url.relative(self.options.cssDest, destFont);
        var spriteFileName = path.basename(destFont + '.svg');

        var spritesheetInfo = {
          width: 0,
          height: 0,
          image: spritePath,
          container: spriteInfo.name,
          spriteFileName: spriteFileName
        };

        glyphs.forEach(function(g) {
          // console.log(g.unicode[0]);
          g.unicode = escape(g.unicode[0]);
          g.unicode = g.unicode.replace('%u', '\\');
        });

        // Render the variables via `spritesheet-templates`
        // console.log(glyphs);
        var cssStr = templater({
          items: glyphs,
          spritesheet: spritesheetInfo 
        }, {
          format: 'scss',
          formatOpts: {},
          spritesheetName: 'spritesheet'
        });

        fs.writeFile(destCss, cssStr, 'utf8', function(err) {
          if (err) {
            self.logger.log(chalk.red('Error generating spritesheets: ') + err);
            reject(err);
          }

          self.logger.log('Files "' + destCss + '", "' + destFont + '" created.');
          resolve();
        });
      }
    });

    var metadataProvider = require('svgicons2svgfont/src/metadata')({
      startUnicode: 0xEA01,
      appendUnicode: false
    });

    var data = '';
    var svgo = new SVGO({
      plugins: [
        { removeUselessStrokeAndFill: false }
      ]
    });

    Promise.all(icons.map(function(icon) {
      return new Promise(function(resolve, reject) {
        metadataProvider(icon, function(err, metadata) {
          if (err) {
            fontStream.emit('error', err);
            return reject(err);
          }

          // var glyph = fs.createReadStream(icon);
          // glyph.metadata = metadata;
          //
          // fontStream.write(glyph);
          // resolve(glyph);


          // metadata.unicode[0] = String.fromCodePoint(options.startUnicode++);
          fs.readFile(icon, 'utf8', function(err, data) {
              if (err) {
                return reject(err);
              }

              svgo.optimize(data, function(result) {

                  var glyph = new Readable({ objectMode: true });
                  glyph.push(new Buffer(result.data));
                  glyph.push(null);

                  glyph.metadata = metadata;

                  fontStream.write(glyph);
                  resolve(glyph);
              });

          });
        });
      })

    })).then(function() {

      fontStream.end();

    }).catch(self.logger.log);

    fontStream.on('data', function(chunk) {
      data += chunk;
    });

    fontStream.on('end', function(chunk) {
      var ttf = svg2ttf(data, {});
      fs.writeFileSync(destFont + '.ttf', new Buffer(ttf.buffer));
      fs.writeFileSync(destFont + '.eot', ttf2eot(ttf.buffer));
      fs.writeFileSync(destFont + '.woff', ttf2woff(ttf.buffer));
    });

    // Setting the font destination 
    fontStream.pipe(fs.createWriteStream(destFont + '.svg'))
    .on('finish',function() {
      self.logger.log('Font successfully created!')
    })
    .on('error',function(err) {
      self.logger.log(err);
    });
  })
}

module.exports = SpritegenSheets;
