var path = require('path');
var chai = require('chai');
var chaiAsPromised = require("chai-as-promised");
var sinon = require('sinon');
var sinonChai = require('sinon-chai');
var expect = chai.expect;
var should = chai.should();
var SpritegenSheets = require('../../index');

chai.use(chaiAsPromised);
chai.use(sinonChai);

describe('lib/mundler', function() {

  var testConfig = {
    cwd: 'test/fixtures/img',
    src: [
      'icons/*.png',
      'arrows/*.png'
    ],
    dest: 'test/output/cwd/sprites',
    padding: 35,
    algorithm: 'top-down',
    engine: 'pixelsmith',
    sheetFormat: 'scss',
    sheetDest: 'test/output/cwd/scss'
  };

  var testConfigWithWatch = {
    cwd: 'test/fixtures/img',
    src: [
      'icons/*.png',
      'arrows/*.png'
    ],
    dest: 'test/output/cwd/sprites',
    padding: 35,
    algorithm: 'top-down',
    engine: 'pixelsmith',
    sheetFormat: 'scss',
    sheetDest: 'test/output/cwd/scss',
    watch: true,
  };

  var testConfigStringSrc = {
    cwd: 'test/fixtures/img',
    src:  'arrows/*.png',
    dest: 'test/output/stringsrc/sprites',
    padding: 35,
    algorithm: 'top-down',
    engine: 'pixelsmith',
    sheetFormat: 'scss',
    sheetDest: 'test/output/stringsrc/scss'
  };

  var testConfigNoCwd = {
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

  var testConfigMissingSrc = {
    dest: 'test/output/cwd/sprites',
    padding: 35,
    algorithm: 'top-down',
    engine: 'pixelsmith',
    sheetFormat: 'scss',
    sheetDest: 'test/output/cwd/scss'
  };

  var testConfigMissingDest = {
    src: [
      'test/fixtures/img/icons/*.png',
      'test/fixtures/img/arrows/*.png'
    ],
    padding: 35,
    algorithm: 'top-down',
    engine: 'pixelsmith',
    sheetFormat: 'scss',
    sheetDest: 'test/output/cwd/scss'
  };

  describe('SpritegenSheets', function() {
    var s;

    beforeEach(function() {
      s = SpritegenSheets(testConfig);
    });

    afterEach(function() {
      s = null;
    });

    describe('#glob()', function() {

      it('should return a promise with an array of files', function() {
        return s.glob(path.resolve('test') + '/**/*.png').should.eventually.have.length.above(20);
      });

      it('should reject with an error if not found', function() {
        return s.glob(path.resolve('nonExistentTest') + '/**/*.png').should.reject;
      });

    });

    describe('#verifyRequiredProps()', function() {
      it('should reject if no "src" is configured', function() {
        expect(function() {
          return s.verifyRequiredProps(testConfigMissingSrc);
        }).to.throw('Missing property "src" in SpritegenSheets config');
      });

      it('should reject if no "dest" is configured', function() {
        expect(function() {
          return s.verifyRequiredProps(testConfigMissingDest)
        }).to.throw('Missing property "dest" in SpritegenSheets config');
      });
    });

    describe('#start()', function() {
      it('should call #walkAndGenerate()', function(done) {
        var spy = sinon.spy(s, 'walkAndGenerate');

        s.start().then(function(info) {
          spy.should.have.been.calledTwice;
          done();
        }).catch(done);
      });

      it('should call #watch() if watch option is used', function(done) {
        s = SpritegenSheets(testConfigWithWatch);
        var spy = sinon.spy(s, 'watch');

        s.start().then(function(info) {
          spy.should.have.been.calledOnce;
          done();
        }).catch(done);
      });

      it('should return an array of objects if src is an array', function(done) {
        s.start().then(function(info) {
          expect(Array.isArray(info)).to.equal(true);
          expect(info.length).to.equal(2);
          done();
        }).catch(done);
      });

      it('should accept src as a string or array', function(done) {
        s = SpritegenSheets(testConfigStringSrc);

        s.start().then(function(info) {
          expect(typeof info).to.equal('object');
          expect(Object.keys(info.coords)).to.have.length(17);
          done();
        }).catch(done);
      });

      it('should work without a cwd', function(done) {
        s = SpritegenSheets(testConfigNoCwd);

        s.start().then(function(info) {
          expect(Array.isArray(info)).to.equal(true);
          expect(info.length).to.equal(2);
          done();
        }).catch(done);
      });
    });

    describe('#walkAndGenerate()', function() {
      it('should recurse through directory and generate a sprite from all images', function() {
      });
    });

    describe('#generateSprite()', function() {
      it('should create a sprite', function() {
      });

      it('should create a spritesheet', function() {
      });

      it('should use spritesheet template if configured to', function() {
      });

      it('should fallback to CSS', function() {
      });
    });
  });
});
