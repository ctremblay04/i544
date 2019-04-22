'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const mustache = require('mustache');
const querystring = require('querystring');

const STATIC_DIR = 'statics';
const TEMPLATES_DIR = 'templates';

function serve(port, base, model) {
  const app = express();
  app.locals.port = port;
  app.locals.model = model;
  
  app.use(base, express.static(STATIC_DIR));
  setupTemplates(app);
  setupRoutes(app);
  app.listen(port, function() {
    console.log(`listening on port ${port}`);
  });
}

module.exports = serve;

/******************************** Routes *******************************/

function setupRoutes(app) {
  app.get(`/text-translate.html`, staticTranslate(app));
  app.get(`/url-info.html`, getUrl(app));
  app.get(`/url-deactivate.html`, staticDeactivate(app));
  app.post(`/text-translate.html`, bodyParser.urlencoded({ extended: false }), doTranslate(app));
  app.post(`/url-deactivate.html`, bodyParser.urlencoded({ extended: false }), deactivate(app));

}

function staticTranslate(app) {
  return async function(req, res) {
    let model = {};
    const html = doMustache(app, 'text-translate', model);
    res.send(html);
  }
}

function getUrl(app) {
  return async function(req, res) {
    let model = {};
    if (req.query.isSubmit) {
      const url = req.query.url;
      if (url.trim() === '') {
        model = {error: 'URL must not be empty'};
      }
      else {
	try {
          const result = await app.locals.model.getInfo(url);
          model = {url: url, result : result};
	}
	catch (err) {
          model = {error : err.message, url: url};
        }
      }
    }
    const html = doMustache(app, 'url-info', model);
    res.send(html);
  }
}

function staticDeactivate(app) {
  return async function(req, res) {
    let model = {};
    const html = doMustache(app, 'deactivate-url', model);
    res.send(html);
  }
}

function doTranslate(app) {
  return async function(req, res) {
    const text = req.body.text;
    let model = {}
    if (text.trim() === '') {
      model = {error: 'Non-empty text must be provided for shortening'}
    }
    else {
      const result = await app.locals.model.translate(text);
      model = {result: result.value, text: text}
    }
    const html = doMustache(app, 'text-translate', model);
    res.send(html);
  };
};

function deactivate(app) {
  return async function(req, res) {
    let model = {};
    const url = req.body.url;
    if (url.trim() === '') {
      model = {error: 'URL must not be empty'};
    }
    else {
      try {
        const result = await app.locals.model.deactivate(url);
        model = {url: url, result : url+' has been deactivated'};
      }
      catch (err) {
        model = {error : err.message, url: url};
      }
    }
    const html = doMustache(app, 'deactivate-url', model);
    res.send(html);
  }
}


/********************** General Utilities ****************************/

/** Decode an error thrown by web services into an errors hash
 *  with a _ key.
 */
function wsErrors(err) {
  const msg = (err.message) ? err.message : 'web service error';
  console.error(msg);
  return { _: [ msg ] };
}

function doMustache(app, templateId, view) {
  const templates = { footer: app.templates.footer };
  return mustache.render(app.templates[templateId], view, templates);
}

function errorPage(app, errors, res) {
  if (!Array.isArray(errors)) errors = [ errors ];
  const html = doMustache(app, 'errors', { errors: errors });
  res.send(html);
}

function isNonEmpty(v) {
  return (v !== undefined) && v.trim().length > 0;
}

function setupTemplates(app) {
  app.templates = {};
  for (let fname of fs.readdirSync(TEMPLATES_DIR)) {
    const m = fname.match(/^([\w\-]+)\.ms$/);
    if (!m) continue;
    try {
      app.templates[m[1]] =
	String(fs.readFileSync(`${TEMPLATES_DIR}/${fname}`));
    }
    catch (e) {
      console.error(`cannot read ${fname}: ${e}`);
      process.exit(1);
    }
  } 
}
