#!/usr/bin/env nodejs

'use strict';

const assert = require('assert');
const process = require('process');

const ShortenerWs = require('./shortener-ws');
const Shortener = require('./shortener.js');

function usage() {
  console.error(`usage: ${process.argv[1]} WS_URL PORT`);
  process.exit(1);
}

function getPort(portArg) {
  let port = Number(portArg);
  if (!port) usage();
  return port;
}

const BASE = '';

async function go(args) {
  try {
    const port = getPort(args[1]);
    const wsBaseUrl = args[0];
    const shortenerWs = new ShortenerWs(wsBaseUrl);
    Shortener(port, BASE, shortenerWs);
  }
  catch (err) {
    console.error(err);
  }
}
    

if (process.argv.length != 4) usage();
go(process.argv.slice(2));
