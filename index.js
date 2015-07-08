'use strict';

var path = require('path');
var fs = require('fs');
var SpritegenSheets = require('./lib/spritegen-sheets');

module.exports = function init(o, args) {
  var options;

  if (!!o) {
    if (typeof o !== 'object' || Array.isArray(o)) {
      throw new Error('SpritegenSheets options must be an object');
    }

    options = o;
  }
  else if (args && (!!args.config || (!!args._ && args._.length))) {
    if (args._ && args._.length) {
      options = args;
      options.src = args._[0];
    }
    else {
      try {
        options = require(args.config);
      }
      catch (e) {
        throw e;
      }
    }
  }
  else {
    try {
      var mainPackage = require(path.resolve('package.json'));

      if (!!mainPackage.spritegen_sheets) {
        options = mainPackage.spritegen_sheets;
      }
      else {
        var config = path.resolve('spritegen-sheets.config.js');

        if (fs.existsSync(config)) {
          options = require(config);
        }
        else {
          throw new Error('Cannot find spritegen-sheets.config.js configuration');
        }
      }
    }
    catch (e) {
      throw e;
    }
  }

  // Override any options that are set in CLI
  if (args) {
    for (var prop in args) {
      if (args.hasOwnProperty(prop) && !!args[prop]) {
        if (args[prop] === 'true') {
          options[prop] = true;
        }
        else if (args[prop] === 'false') {
          options[prop] = false;
        }
        else {
          options[prop] = args[prop];
        }
      }
    }
  }

  return new SpritegenSheets(options);
};
