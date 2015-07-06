var fs = require('fs');
var path = require('path');
var url = require('url2');
var shell = require('shelljs');
var async = require('async');
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
    padding: 0,
    algorithm: 'top-down',
    engine: 'gmsmith',
    sheetDest: 'css',
    sheetFormat: 'css',
    sheetTemplate: true,
    watch: false
  }
}

function catchError(e) {
  console.log(e);
}

function SpriteWatch(options) {
  this.options = assign({}, defaultOptions(), options);

  this.cwd = this.options.cwd || false;
  this.src = this.options.src;
  this.dest = this.options.dest;
  this.sheetTemplate = this.options.sheetTemplate;
  this.sheetFormat = this.options.sheetFormat;
}

SpriteWatch.prototype.start = function() {
  var self = this;

  console.log(chalk.bold(
    'Starting SpriteWatch...\n'
  ));

  if (this.options.watch) {
    var srcDir = this.src;

    if (typeof srcDir === 'string') {
      var baseDir = path.dirname(srcDir);
      console.log(chalk.italic(
        'Watching "'+baseDir+'" for changes...\n'
      ));
    }
    else {
      var ending = '';

      for (var i = 0; i < srcDir.length; i++) {
        var baseDir = path.dirname(srcDir[i]);

        if (i === srcDir.length - 1) {
          ending = '\n';
        }

        console.log(chalk.italic(
          'Watching "' + baseDir + '" for changes...' + ending
        ));
      }
    }
  }

  return Promise.all(this.src
    .map(function(src) {
      return self.walkAndGenerate(src).then(function(info) {
        return info;
      }).catch(catchError);
    })
  ).then(function(info) {

    if (self.options.watch) {
      self.watch();
    }

    return info[0]
  }).catch(catchError);
}

SpriteWatch.prototype.watch = function() {
  var self = this;

  var watcher = chokidar.watch(this.src, { cwd: this.cwd || process.cwd() });

  watcher.on('error', function(err) {
    console.log(err);
  });

  watcher.on('ready', function() {
    watcher.on('all', function(event, filepath) {
      if (event === 'add' || event === 'unlink') {
        var src = self.src;

        if (typeof src === 'string') {
          self.walkAndGenerate(self.src).catch(catchError);
        }
        else {
          var dirname = path.dirname(filepath);

          for (var i = 0; i < src.length; i++) {
            var currentSrc = src[i];
            var srcDir = path.dirname(currentSrc);

            if (dirname === srcDir) {
              self.walkAndGenerate(currentSrc).catch(catchError);
            }
          }
        }
      }
    });
  });
}

SpriteWatch.prototype.glob = function(src) {
  var self = this;

  return new Promise(function(resolve, reject) {
    glob(src, { cwd: self.cwd || process.cwd() }, function(err, files) {
      if (err) {
        reject(err);
      }
      else {
        resolve(files);
      }
    });
  });
}

SpriteWatch.prototype.walkAndGenerate = function(src) {
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
    }).catch(catchError);
  }).catch(catchError);
}

SpriteWatch.prototype.generateSprite = function(spriteInfo, images) {
  var self = this;

  var spritesmithParams = {
    src: images,
    padding: this.options.padding,
    algorithm: this.options.algorithm,
    engine: this.options.engine
  }

  if (this.sheetTemplate === true) {
    this.sheetTemplate = path.resolve(__dirname, '../templates/compass-compatible.mustache');
  }

  var destImgDir = this.dest;
  var destImg = destImgDir + '/' + spriteInfo.name + '-sprite.png';

  if (this.dest) {
    var destCss = this.options.sheetDest + '/_' + spriteInfo.name + '.' + this.sheetFormat;
  }
  else {
    if (!fs.existsSync('css')) {
      shell.mkdir('css');
    }

    var destCss = 'css/' + spriteInfo.name + '.' + this.sheetFormat;
  }

  return new Promise(function(resolve, reject) {

    spritesmith(spritesmithParams, function (err, result) {
      if (err) {
        return reject(chalk.red('Error generating sprites: ') + err);
      }

      // Create the image path if doesn't exist
      if (!fs.existsSync(destImgDir)) {
        shell.mkdir(destImgDir);
      }

      var cleanCoords = [], spritesheetInfo;

      // create the sprite
      fs.writeFile(destImg, result.image, 'binary', function(err) {
        if (err) {
          return reject(chalk.red('Error creating sprite: ') + err);
        }

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

        // Write it out to the CSS file
        // Create the image path if doesn't exist
        var destCssDir = path.dirname(destCss);

        if (!fs.existsSync(destCssDir)) {
          shell.mkdir(destCssDir);
        }

        fs.writeFile(destCss, cssStr, 'utf8', function(err) {
          if (err) {
            return reject(chalk.red('Error generating spritesheets: ') + err);
          }

          console.log('Files "' + destCss + '", "' + destImg + '" created.');
          resolve({ coords: cleanCoords, info: spritesheetInfo });
        });
      });
    });

  }.bind(this));
}

module.exports = SpriteWatch;
