#!/usr/bin/env node

var spritegenSheets = require('./');
var argv = require('yargs')
    .usage('Usage: sprite-watch <sources> --dest [str] --sheetDest [str] -p [num] -a [str] -e [str] -f [str] -t [str] -c [str] -w [bool]')
    .alias('d', 'dest')
    .describe('d', 'Sprite destination directory')
    .alias('s', 'sheetDest')
    .describe('s', 'Spritesheet destination directory')
    .alias('p', 'padding')
    .describe('p', 'Padding to add around sprite images')
    .alias('a', 'algorithm')
    .describe('a', 'Algorithm to use when generating sprite')
    .alias('e', 'engine')
    .describe('e', 'Engine to use to generate sprites')
    .alias('f', 'sheetFormat')
    .describe('f', 'Spritesheet output format')
    .alias('t', 'sheetTemplate')
    .describe('t', 'Path to a custom spritesheet template. Leave empty to use a compass compatible default, or set false to use the specified formats default')
    .alias('c', 'config')
    .describe('c', 'Path to custom config')
    .alias('w', 'watch')
    .describe('w', 'Whether to watch source directory')
    .help('h')
    .alias('h', 'help')
    .argv;

var sprites = spritegenSheets(null, argv);
sprites.start();

