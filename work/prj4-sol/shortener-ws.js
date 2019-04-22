'use strict';

const axios = require('axios');


function ShortenerWs(baseUrl) {
  this.shortenerUrl = baseUrl;
}

module.exports = ShortenerWs;

ShortenerWs.prototype.translate = async function(text) {
  try {
    const response = await axios.post(`${this.shortenerUrl}/x-text`, {isHtml: true, text: text});
    return response.data;
  }
  catch (err) {
    console.error(err);
    throw (err.response && err.response.data) ? err.response.data : err;
  }
};

ShortenerWs.prototype.deactivate = async function(url) {
  try {
    const response = await axios.delete(`${this.shortenerUrl}/x-url?url=${url}`);
    return response.data;
  }
  catch (err) {
    console.error(err);
    throw (err.response && err.response.data) ? err.response.data : err;
  }
};

ShortenerWs.prototype.getInfo = async function(url) {
  try {
    const response = await axios.get(`${this.shortenerUrl}/x-url?url=${url}`);
    return response.data;
  }
  catch (err) {
    console.error(err);
    throw (err.response && err.response.data) ? err.response.data : err;
  }
};

