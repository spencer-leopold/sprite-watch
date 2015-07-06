#!/usr/bin/env node

var spritegenSheets = require('./');
var argv = require('yargs')
    .usage('Usage: sprite-watch <sources> -d [str] -o [str] -p [num] -a [str] -e [str] -f [str] -t [str] -w [bool]')
    .alias('d', 'dest')
    .default('d', 'img/sprites')
    .describe('d', 'Specify sprite destination directory')
    .alias('o', 'sheetOutput')
    .default('o', 'css')
    .describe('o', 'Specify spritesheet output path')
    .alias('p', 'padding')
    .default('p', 0)
    .describe('p', 'Padding to add around sprite images')
    .alias('a', 'algorithm')
    .default('a', 'top-down')
    .describe('a', 'Algorithm to use when generating sprite')
    .alias('e', 'engine')
    .default('e', 'pixelsmith')
    .describe('e', 'Engine to use to generate sprites')
    .alias('f', 'sheetFormat')
    .default('f', 'css')
    .describe('f', 'Spritesheet output format')
    .alias('t', 'sheetTemplate')
    .default('t', true)
    .describe('t', 'Path to a custom spritesheet template.  Leave empty to use a compass compatible default, or set false to use the specified formats default')
    .alias('w', 'watch')
    .default('w', false)
    .describe('w', 'Whether to watch source directory')
    .help('h')
    .alias('h', 'help')
    .argv;

var sprites = spritegenSheets(null, argv);
sprites.start();

