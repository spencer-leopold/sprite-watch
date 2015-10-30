module.exports = {
  src: [
    'test/fixtures/img/icons/*.png',
    'test/fixtures/img/arrows/*.png'
  ],
  dest: 'test/output/nocwd/',
  padding: 35,
  algorithm: 'top-down',
  engine: 'pixelsmith',
  sheetFormat: 'scss',
  sheetDest: 'test/output/nocwd/scss/'
};
