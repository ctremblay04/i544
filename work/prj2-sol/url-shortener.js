'use strict';

const assert = require('assert');
const mongo = require('mongodb').MongoClient;

class UrlShortener {

  /** 
   *  The return value for each of the following methods must be
   *  an object.  If an error occurs, then the returned object must
   *  have an 'error' property which itself must be an object having
   *  at least the following 2 properties:
   *
   *   'code':   A short string which specifies the class of error
   *             which occurred.
   *   'message':A detailed string describing the error in as much
   *             detail as possible. 
   *
   *  The specifications for the methods below specify the 'code'; the
   *  'message' can be any suitable description of the error.  The
   *  intent is that the 'code' property is suitable for use by
   *  machines while the 'message' property is suitable for use by
   *  humans.
   *
   *  When a URL is deactivated, any association for that URL is
   *  merely deactivated and not removed.  While deactivated, the
   *  association is not returned by the `query()` method until it is
   *  added again using the `add()` method.
   */

  /** Factory method for building a URL shortener with specified mongoDbUrl
   *  and shortenerBase.
   *
   *  The mongoDbUrl parameter must be a valid URL with scheme set
   *  to mongodb.
   *
   * The shortenerBase parameter must consists of a valid domain followed
   * by an optional port.
   * 
   * If everything is ok, this factory method should return a new
   * instance of this.
   *
   * If an error occurs, then the following error codes should be
   * returned:
   *
   *   BAD_MONGO_URL: mongodbUrl is invalid.
   *   BAD_SHORTENER_BASE: shortenerBase is invalid.
   */
  static async make(mongoDbUrl, shortenerBase) {
    let mongoParts = getUrlParts(mongoDbUrl);
    validateScheme(mongoParts, RegExp('^mongodb$'));
    if (mongoParts.error)
      return { error: { code: 'BAD_MONGO_URL', message: `BAD_MONGO_URL: mongodbUrl is invlid ${mongoParts.url}` } };
    if (!validateBase(shortenerBase))
      return { error: { code: 'BAD_SHORTENER_BASE', message: `BAD_SHORTENER_BASE: shortenerBase is invlid ${shortenerBase}` } };
    const client = await mongo.connect(mongoParts.url, MONGO_OPTIONS);
    const db = client.db(shortenerBase);
    return new UrlShortener(shortenerBase, client, db);
  }

  /** Create a URL shortener with SHORTENER_BASE set to base. */
  constructor(base, client, db) {
    this.SHORTENER_BASE = base;
    this.db = db;
    this.col = this.db.collection(URL_TABLE);
    this.client = client;
  }

  /** Release all resources held by this url-shortener.  Specifically,
   *  close any database connections.  Return empty object.
   */
  async close() {
    await this.client.close();
  }

  /** Clear database */
  async clear() {
    await this.col.deleteMany({});
    return {};
  }


  /** The argument longUrl must be a legal url.  It is ok if it has
   *  been previously added or deactivated.  The base of longUrl cannot
   *  be the same as the base of this url-shortener.
   *
   *  If there are no errors, then return an object having a 'value'
   *  property which contains the short url corresponding to longUrl.
   *  If longUrl was previously added, then the short url *must* be
   *  the same as the previously returned value.  If long url is
   *  currently deactivated, then it's previous association is made
   *  available to subsequent uses of the query() method.
   *
   *  Errors corresponding to the following 'code's should be detected:
   *
   *   'URL_SYNTAX': longUrl syntax is incorrect (it does not contain
   *                 a :// substring, its domain is invalid).
   *
   *   'DOMAIN':     base of longUrl is equal to shortUrl base.
   */
  async add(longUrl) {
    let urlParts = getUrlParts(longUrl);
    validateScheme(urlParts, RegExp('^https?$'));
    if (urlParts.error) //URL_SYNTAX
      return urlParts.error;
    if (urlParts.domain === this.SHORTENER_BASE) { //DOMAIN
      this.setErrMsg(urlParts, 'DOMAIN_EQ');
      return urlParts.error;
    }
    let urlInfo = await this._queryDb(urlParts.baseRest);
    if ( urlInfo ) {
      await this.col.updateOne(urlInfo, { $set: { active: true } } );
    }
    else {
      let newUrl = this.SHORTENER_BASE+'/'+Math.floor(Math.random()*2**32).toString(36);
      urlInfo = { longUrl: urlParts.baseRest, shortUrl: newUrl, active : true, queries : 0 };
      await this.col.insertOne(urlInfo);
    }
    return { value : urlParts.scheme + '://' + urlInfo.shortUrl };
  }

  /** The argument shortUrl must be a shortened URL previously
   *  returned by the add() method which has not subsequently been
   *  deactivated by the deactivate() method.
   *
   *  If there are no errors, then return an object having a 'value'
   *  property which contains the long url corresponding to shortUrl.
   *
   *  Errors corresponding to the following 'code's should be
   *  detected:
   *
   *   'URL_SYNTAX': shortUrl syntax is incorrect (it does not contain
   *                 a :// substring or the base is invalid.
   *
   *   'DOMAIN':     shortUrl base is not equal to SHORTENER_BASE.
   *
   *   'NOT_FOUND':  shortUrl is not currently registered for this
   *                 service.
   */
  async query(shortUrl) {
    let urlParts = getUrlParts(shortUrl);
    validateScheme(urlParts, RegExp('^https?$'));
    if (urlParts.error) //URL_SYNTAX
      return urlParts.error;
    if (urlParts.domain !== this.SHORTENER_BASE) { //DOMAIN
      this._setErrMsg(urlParts, 'DOMAIN_NE');
      return urlParts.error;
    }
    let urlInfo = await this._queryDb(urlParts.baseRest);
    if (!urlInfo || !urlInfo.active) { //NOT_FOUND
      this._setErrMsg(urlParts, 'NOT_FOUND');
      return urlParts.error;
    }
    await this.col.updateOne(urlInfo, {$set: { queries: urlInfo.queries+1 } } );
    return { value: urlParts.scheme+'://'+urlInfo.longUrl};
  }


  /** The argument url must be one of a previously added (longUrl,
   *  shortUrl) pair.  It may be the case that url is currently
   *  deactivated.
   *
   *  If there are no errors, then return an object having a 'value'
   *  property which contains a count of the total number of times
   *  shortUrl was successfully looked up using query().  Note that
   *  the count should be returned even if url is currently deactivated.
   *
   *  Errors corresponding to the following 'code's should be detected:
   *
   *   'URL_SYNTAX': url syntax is incorrect (it does not contain
   *                 a :// substring, or the base is invalid).
   *
   *   'NOT_FOUND':  url was never registered for this service.
   */
  async count(url) {
    let urlParts = getUrlParts(url);
    validateScheme(urlParts, RegExp('^https?$'));
    if (urlParts.error) //URL_SYNTAX
      return urlParts.error;
    let urlInfo = await this._queryDb(urlParts.baseRest);
    if (!urlInfo) { // NOT_FOUND
      this._setErrMsg(urlParts, 'NOT_FOUND');
      return urlParts.error;
    }
    return { value: urlInfo.queries};
  }

  
  /** The argument url must be one of a previously added (longUrl,
   *  shortUrl) pair.  It is not an error if the url has already
   *  been deactivated.
   *
   *  If there are no errors, then return an empty object and make the
   *  association between (longUrl, shortUrl) unavailable to
   *  future uses of the query() method.
   *
   *  Errors corresponding to the following 'code's should be detected:
   *
   *   'URL_SYNTAX':  url syntax is incorrect (it does not contain
   *                  a :// substring, or the base is invalid).
   *
   *   'NOT_FOUND':  url was never registered for this service.
   */
  async deactivate(url) {
    let urlParts = getUrlParts(url);
    validateScheme(urlParts, RegExp('^https?$'));
    if (urlParts.error) //URL_SYNTAX
      return urlParts.error;
    let urlInfo = await this._queryDb(urlParts.baseRest);
    if (!urlInfo) { // NOT_FOUND
      this._setErrMsg(urlParts, 'NOT_FOUND');
      return urlParts.error;
    }
    await this.col.updateOne(urlInfo, {$set: { active: false } } );
    return {};
  }

  //private utility methods can go here.
  
  //For error messages which are specific to an instance of UrlShortener
  _setErrMsg(urlParts, errMsg) {
    switch (errMsg) {
      case 'DOMAIN_EQ':
        urlParts.error = { error: { code: 'DOMAIN', message: `DOMAIN: domain ${urlParts.domain} equal to ${this.SHORTENER_BASE}` } };
        break;
      case 'DOMAIN_NE':
        urlParts.error = { error: { code: 'DOMAIN', message: `DOMAIN: domain of url ${urlParts.domain} not equal to ${this.SHORTENER_BASE}` } };
        break;
      case 'NOT_FOUND':
        urlParts.error = { error: { code: 'NOT_FOUND', message: `NOT_FOUND: ${urlParts.url} not found` } };
        break;
      default:
        urlParts.error = { error: { code: 'UNKNOWN', message: `UNKNOWN: unknown error, something went wrong :(` } };
    }
  }
  
  //Return the value inside of a promise when querying the mongodb database
  async _queryDb(url) {
    return await this.col.findOne({$or: [{longUrl:url}, {shortUrl:url}]})
                     .then( function (result) { return result; } )
                     .catch( function (err) { return null; } );
  }
}

module.exports = UrlShortener

//This may be useful to specify as options when creating
//a mongo client connection
const MONGO_OPTIONS = {
  useNewUrlParser: true
};

const URL_TABLE = 'urlInfo';

//private utility functions can go here.

//Seperate url string into it's parts so that it can be more easily utilized.
function getUrlParts(url) {
  let retObj = { scheme: null, base: null, domain: null, rest: null, baseRest: null , url: url, error: null};
  let ind0 = url.indexOf('://')+3;
  if (ind0 === 2 || ind0 === 3 || url.length === ind0 || url[ind0] === '/') {
    setUrlSyntaxError(retObj);
    return retObj;
  }
  
  retObj.scheme = url.substring(0,ind0-3).toLowerCase();
  retObj.baseRest = url.substring(ind0).toLowerCase();
  let ind1 = url.substring(ind0).indexOf('/');
  if (ind1 === -1)
    retObj.base = retObj.baseRest;
  else {
    retObj.base = url.substring(ind0, ind0+ind1).toLowerCase();
    retObj.rest = url.substring(ind0+ind1);
  }
  if (!validateBase(retObj.base)) {
    setUrlSyntaxError(retObj);
    return retObj;
  }      
  let ind2 = retObj.base.indexOf(':');
  if (ind2 === -1)
    ind2 = retObj.base.length;
  retObj.domain = retObj.base.substring(0,ind2);
  retObj.url = retObj.scheme+'://'+retObj.baseRest;
  return retObj;
}

//Set a urlParts instance error to a URL_SYNTAX error
function setUrlSyntaxError(urlParts) {
  urlParts.error = { error: { code: 'URL_SYNTAX', message: `URL_SYNTAX: bad url ${urlParts.url}` } };
}

//Make sure scheme matches passed in regex, otherwise call SetUrlSyntaxError on urlParts
function validateScheme(urlParts, regex) {
  if (!regex.test(urlParts.scheme))
    setUrlSyntaxError(urlParts);
}

//Return a boolean value for if the base is valid or not
function validateBase(base) {
  let ind0 = base.indexOf(':');
  if (ind0 === -1)
    ind0 = base.length;
  else {
    let portNum = parseInt(base.substring(ind0+1));
      if (isNaN(portNum) || portNum < 1 || portNum >= 2**16)
        return false;
  } 
  let parts = base.substring(0,ind0).split('.'); 
  for (const part of parts) {
    if (!(RegExp('^[a-zA-Z0-9\.\-]+$').test(part) && part[0] !== '-' && part[part.length-1] !== '-'))
      return false;
  } 
  return base.length < 254;
}



