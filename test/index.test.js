var path = require('path');
var chai = require('chai');
var chaiAsPromised = require("chai-as-promised");
var sinon = require('sinon');
var sinonChai = require('sinon-chai');
var expect = chai.expect;
var should = chai.should();
var SpritegenSheets = require('../');

chai.use(chaiAsPromised);
chai.use(sinonChai);

describe('init', function() {
  var testConfig = {
    src: [
      'test/fixtures/img/icons/*.png',
      'test/fixtures/img/arrows/*.png'
    ],
    dest: 'test/output/nocwd/sprites',
    padding: 35,
    algorithm: 'top-down',
    engine: 'pixelsmith',
    sheetFormat: 'scss',
    sheetDest: 'test/output/nocwd/scss'
  };

  it('should accept an object being passed in', function() {
    var s = SpritegenSheets(testConfig);

    for (prop in testConfig) {
      s.options[prop].should.deep.equal(testConfig[prop]);
    }
  });

  it('should accept a config file path as a argument', function() {
    var s = SpritegenSheets(null, { config: './test/helpers/testConfig.js' });

    for (prop in testConfig) {
      s.options[prop].should.deep.equal(testConfig[prop]);
    }
  });

  it('should throw an error if the first argument is not an object', function() {
    var spy = sinon.spy(SpritegenSheets);

    expect(function() {
      var s = SpritegenSheets(['test']);
    }).to.throw('SpritegenSheets options must be an object');
  });

  it('should throw an error if config path argument cannot be found', function() {
    var spy = sinon.spy(SpritegenSheets);

    expect(function() {
      SpritegenSheets(null, { config: './helpers/testConfig.js' });
    }).to.throw("Cannot find module './helpers/testConfig.js'");
  });

  it('should throw an error if it cannot find a spritegen-sheets.config.js or a spritegen-sheets property in package.json', function() {
    var spy = sinon.spy(SpritegenSheets);

    expect(function() {
      SpritegenSheets(null);
    }).to.throw("Cannot find spritegen-sheets.config.js configuration");
  });
});
