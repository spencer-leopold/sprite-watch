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
var chalk = require('chalk');

chalk.enabled = true;

function defaultOptions() {
  return {
    dest: 'img/sprites',
    padding: 25,
    algorithm: 'top-down',
    engine: 'pixelsmith',
    sheetDest: 'css',
    sheetFormat: 'css',
    sheetTemplate: true,
    watch: false
  };
}

function SpritegenSheets(options) {
  this.verifyRequiredProps(options, function(props) {
    this.options = assign({}, defaultOptions(), props);
    
    this.src = props.src;
    this.dest = props.dest;
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
  else if (!props.hasOwnProperty('dest')) {
    throw new Error('Missing property "dest" in SpritegenSheets config');
  }
  else {
    callback(props);
  }
};

SpritegenSheets.prototype.start = function() {
  var self = this;

  if (this.logger === console) {
    this.logger.log(chalk.bold(
      'Starting SpritegenSheets...\n'
    ));
  }

  if (this.options.watch) {
    var baseDir, ending = '', srcDir = this.src;

    if (typeof srcDir === 'string') {
      baseDir = path.dirname(srcDir);

      self.logger.log('Watching "'+baseDir+'" for changes...\n');
    }
    else {
      for (var i = 0; i < srcDir.length; i++) {
        baseDir = path.dirname(srcDir[i]);

        if (i === srcDir.length - 1) {
          ending = '\n';
        }

        self.logger.log('Watching "' + baseDir + '" for changes...' + ending);
      }
    }
  }

  if (typeof this.src === 'string') {

    return self.walkAndGenerate(this.src).then(function(info) {

      if (self.options.watch) {
        self.watch();
      }

      return info;
    }).catch(self.logger.log);

  }
  else {

    return Promise.all(this.src
      .map(function(src) {
        return self.walkAndGenerate(src).then(function(info) {
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
};

SpritegenSheets.prototype.watch = function() {
  var self = this;

  var watcher = chokidar.watch(this.src, { cwd: this.basePath });

  watcher.on('error', function(err) {
    self.logger.log(err);
  });

  watcher.on('ready', function() {
    watcher.on('all', function(event, filepath) {
      if (event === 'add' || event === 'unlink') {
        var src = self.src;

        if (typeof src === 'string') {
          self.walkAndGenerate(self.src).catch(self.logger.log);
        }
        else {
          var dirname = path.dirname(filepath);

          for (var i = 0; i < src.length; i++) {
            var currentSrc = src[i];
            var srcDir = path.dirname(currentSrc);

            if (dirname === srcDir) {
              self.walkAndGenerate(currentSrc).catch(self.logger.log);
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

SpritegenSheets.prototype.walkAndGenerate = function(src) {
  var self = this;
  var baseDir = path.dirname(src);
  var name = path.basename(baseDir);

  var spriteInfo = {
    name: name,
    directory: baseDir
  };

  return this.glob(src).then(function(images) {
    return self.generateSprite(spriteInfo, images).then(function(info) {
      return info;
    }).catch(self.logger.log);
  }).catch(self.logger.log);
};

SpritegenSheets.prototype.generateSprite = function(spriteInfo, images) {
  var destCss, self = this;
  var destImgDir = this.dest;
  var destImg = destImgDir + '/' + spriteInfo.name + '-sprite.png';

  var spritesmithParams = {
    src: images,
    padding: this.options.padding,
    algorithm: this.options.algorithm,
    engine: this.options.engine
  };

  if (this.sheetTemplate === true) {
    this.sheetTemplate = path.resolve(__dirname, '../templates/compass-compatible.mustache');
  }

  if (this.dest) {
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

        var streamObj = {
          imgFile: path.basename(destImg),
          spritesheetFile: path.basename(destCss),
          imgStream: imgStream,
          spritesheetStream: spritesheetStream
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

module.exports = SpritegenSheets;
