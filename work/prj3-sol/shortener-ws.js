const cors = require('cors');
const express = require('express');
const bodyParser = require('body-parser');


const OK = 200;
const CREATED = 201;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;
const SERVER_ERROR = 500;

function serve(port, base, model) {
  const app = express();
  app.locals.port = port;
  app.locals.base = base;
  app.locals.model = model;
  setupRoutes(app);
  app.listen(port, function() {
    console.log(`listening on port ${port}`);
  });
}

module.exports = {
  serve: serve
}

function setupRoutes(app) {
  const base = app.locals.base;
  app.use(cors());
  app.use(bodyParser.json());

  //routes for specific urls:
  app.post(`${base}/x-url`, doShorten(app));
  app.delete(`${base}/x-url`, doDeactivate(app));
  app.get(`${base}/x-url`, getInfo(app));
  app.post(`${base}/x-text`, doTextShorten(app));
  app.get(`${base}/:short`, doRedirect(app));

  //error route
  app.use(doErrors()); //must be last   
}


/** Expect shortUrl as entire url; send redirect to long url; 404 if 
 *  not found.
 */
function doRedirect(app) {
  return errorWrap(async function(req, res) {
    try {
      const url = requestUrl(req);
      const results = await app.locals.model.query(url);
      res.redirect(results.value);
    }
    catch (err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}

/** Expect a longUrl as query parameter url.  Return a json
 *  response { value: shortUrl }.
 */
function doShorten(app) {
  return errorWrap(async function(req, res) {
    try {
      const url = req.query.url || '';
      const result = await app.locals.model.add(url);
      res.json(result);
    }
    catch (err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}

/** Expect a short or long Url as query parameter url.  Return a OK
 *  response if url is deactivated.
 */
function doDeactivate(app) {
  return errorWrap(async function(req, res) {
    try {
      const url = req.query.url || '';
      const result = await app.locals.model.deactivate(url);
      res.sendStatus(OK);
    }
    catch (err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}

/** Expect a short or long url as query parameter url.  Return
 *  information for url as a json object containing the following
 *  properties:
 *
 *     longUrl:   the associated long url.
 *     shortUrl:  the associated long url.
 *     count:     a count of the total number of times
 *                shortUrl was successfully looked up using query().  
 *     isActive:  a boolean denoting whether or not the mapping is active.
 *
 * Note that the info should be returned even if url is currently 
 * deactivated.
 *
 */
function getInfo(app) {
  return errorWrap(async function(req, res) {
    try {
      const url = req.query.url || '';
      const result = await app.locals.model.info(url);
      res.json(result);
    }
    catch (err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}

/** Expect a JSON body with property text.  Replace delimited
 *  case-insensitive http:// or https:// urls in text with short url's
 *  by adding in these url as long urls.  If there is something wrong
 *  with a text url, then don't replace it.  A url starts with
 *  http:// or https:// and continues as long as it contains
 *  alphanumeric chars or certain special chars.
 */
function doTextShorten(app) {
  return errorWrap(async function(req, res) {
    try {
      const text = req.body.text || '';
      const isHtml = req.body.isHtml || false;
      let shortened = '';
      lastIndex = 0;
      let match;
      while (match = URL_RE.exec(text)) {
	index = match.index;
	shortened += htmlEscape(isHtml, text.slice(lastIndex, index));
	const url = match[0];
	const urlLen = url.length;
	lastIndex = index + urlLen;
	let result;
	try {
	  result = await app.locals.model.add(url);
	}
	catch (err) { //bad url not replaced
	  result = { value: url };
	}
	if (isHtml) {
	  shortened += `<a href="${result.value}">${result.value}</a>`;
	}
	else {
	  shortened += result.value;
	}
      } //while
      shortened += htmlEscape(isHtml, text.slice(lastIndex)); //last fragment
      return res.json({ value: shortened });
    }
    catch (err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}

function htmlEscape(doEscape, text) {
  if (doEscape) {
    return text
      .replace(/\&/g, '&amp;')
      .replace(/\</g, '&lt;')
      .replace(/\>/g, '&gt;')
      .replace(/\"/g, '&quot;');
  }
  else {
    return text;
  }
}

const URL_RE = /https?\:\/\/[\w\-\/\.\?\=\&\%\#\@\+\~]+/gi;
      
/** Ensures a server error results in nice JSON sent back to client
 *  with details logged on console.
 */ 
function doErrors(app) {
  return async function(err, req, res, next) {
    res.status(SERVER_ERROR);
    res.json({ code: 'SERVER_ERROR', message: err.message });
    console.error(err);
  };
}

/** Set up error handling for handler by wrapping it in a 
 *  try-catch with chaining to error handler on error.
 */
function errorWrap(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    }
    catch (err) {
      next(err);
    }
  };
}

/*************************** Mapping Errors ****************************/

const ERROR_MAP = {
  EXISTS: CONFLICT,
  NOT_FOUND: NOT_FOUND
}

/** Map domain/internal errors into suitable HTTP errors.  Return'd
 *  object will have a "status" property corresponding to HTTP status
 *  code.
 */
function mapError(err) {
  console.error(err);
  return err.code
    ? { status: (ERROR_MAP[err.code] || BAD_REQUEST),
	code: err.code,
	message: err.message
      }
    : { status: SERVER_ERROR,
	code: 'INTERNAL',
	message: err.toString()
      };
} 

/****************************** Utilities ******************************/

/** Return original URL for req */
function requestUrl(req) {
  const port = req.app.locals.port;
  return `${req.protocol}://${req.hostname}:${port}${req.originalUrl}`;
}
  
