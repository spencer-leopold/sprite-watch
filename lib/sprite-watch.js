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
var done;

chalk.enabled = true;

function defaultOptions() {
  return {
    dest: 'img/sprites',
    padding: 0,
    algorithm: 'top-down',
    engine: 'gmsmith',
    sheetOutput: 'css',
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

  return Promise.all(this.src
    .map(function(src) {
      return self.walkAndGenerate(src);
    })
  ).then(function(output) {
    if (self.options.watch) {
      self.watch();
    }

    return output;
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
      // On file change
      for (var i = 0; i < self.src.length; i++) {
        var baseDir = self.src[i].replace('/' + path.basename(self.src[i]), '');
        if (filepath.indexOf(baseDir) !== -1) {
          self.walkAndGenerate(self.src[i]);
        }
      }
    });
  });
}

SpriteWatch.prototype.walkAndGenerate = function(dir) {
  var self = this;
  var baseDir = dir.replace('/' + path.basename(dir), '');
  var name = path.basename(baseDir);

  var spriteInfo = {
    name: name,
    directory: baseDir
  };

  glob(dir, function(err, images) {
    if (err) {
      console.log(err);
      if (done) {
        done(false);
      }
    }

    this.generateSprite(spriteInfo, images);
  }.bind(this));
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
    this.sheetTemplate = __dirname + '/templates/compass-compatible.mustache';
  }

  var destImgDir = this.dest;
  var destImg = destImgDir + '/' + spriteInfo.name + '-sprite.png';

  if (this.dest) {
    var destCss = this.options.sheetOutput + '/_' + spriteInfo.name + '.' + this.sheetFormat;
  }
  else {
    if (!fs.existsSync('css')) {
      shell.mkdir('css');
    }

    var destCss = 'css/' + spriteInfo.name + '.' + this.sheetFormat;
  }

  spritesmith(spritesmithParams, function (err, result) {
    if (err) {
      console.log(chalk.red('Error generating sprites: ') + err);

      if (done) {
        return done(false);
      }

      return;
    }

    // Create the image path if doesn't exist
    if (!fs.existsSync(destImgDir)) {
      shell.mkdir(destImgDir);
    }

    // create the sprite
    fs.writeFileSync(destImg, result.image, 'binary');

    // Generate a listing of CSS variables
    var coordinates = result.coordinates;
    var properties = result.properties;
    var spritePath = url.relative(destCss, destImg);
    var spriteFileName = path.basename(destImg);

    var spritesheetInfo = {
      width: properties.width,
      height: properties.height,
      image: spritePath,
      container: spriteInfo.name,
      spriteFileName: spriteFileName
    };

    var cssVarMap = function noop () {};
    var cleanCoords = [];

    // Clean up the file name of the file
    Object.getOwnPropertyNames(coordinates).sort().forEach(function (file) {
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

    // If there's a custom template, use it
    if (self.sheetTemplate) {
      if (typeof self.sheetTemplate === 'function') {
        templater.addTemplate(cssFormat, self.sheetTemplate);
      } else {
        templater.addMustacheTemplate(cssFormat, fs.readFileSync(self.sheetTemplate, 'utf8'));
      }
    } else {
      // Otherwise, override the cssFormat and fallback to 'json'
      cssFormat = self.sheetFormat;
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
    fs.writeFileSync(destCss, cssStr, 'utf8');

    // Fail task if errors were logged.
    console.log('Files "' + destCss + '", "' + destImg + '" created.');
    if (done && !self.options.watch) {
      done();
    }
  });
}

module.exports = SpriteWatch;
