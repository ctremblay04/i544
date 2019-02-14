'use strict';

class UrlShortener {

  /** Create a URL shortener with SHORTENER_DOMAIN set to domain. */
  constructor(domain) { 
    this.SHORTENER_DOMAIN = domain.toLowerCase();
    this.LONG_ACCESS = {};
    this.SHORT_ACCESS = {};
  }

  /** 
   *  The return value for each of the following methods must be
   *  an object.  If an error occurs, then the returned object must
   *  have an 'error' property which itself must be an object having
   *  at least the following 2 properties:
   *
   *   'code':   A short string which specifies the class of error
   *             which occurred.
   *   'message':A detailed string describing the error in as much
   *             detail as possible.  The message must be prefixed with
   *             the 'code', a colon followed by a single space.
   *
   *  The specifications for the methods below specify the 'code'; the
   *  'message' can be any suitable description of the error.  The
   *  intent is that the 'code' property is suitable for use by
   *  machines while the 'message' property is suitable for use by
   *  humans.
   *
   *  Despite the presence of a `remove()` method, an association
   *  should never actually be removed, merely deactivated so that
   *  it is not returned by the `query()` method until it is
   *  added again using the `add()` method.
   */

  /** The argument longUrl must be a legal url.  It is ok if it has
   *  been previously added or removed.  It's domain cannot be the
   *  domain of this url-shortener.
   *
   *  If there are no errors, then return an object having a 'value'
   *  property which contains the short url corresponding to longUrl.
   *  If longUrl was previously added, then the short url *must* be
   *  the same as the previously returned value.  If long url is
   *  currently removed, then it's previous association is made
   *  available to subsequent uses of the query() method.
   *
   *  Errors corresponding to the following 'code's should be detected:
   *
   *   'URL_SYNTAX': longUrl syntax is incorrect (it does not contain
   *                 a :// substring, its domain is empty.
   *
   *   'DOMAIN':     shortUrl domain is equal to SHORTENER_DOMAIN.
   */
  add(longUrl) {
    let urlParts = this._getUrlParts(longUrl);
    if (urlParts.error) { return urlParts.error; }
    if (urlParts.domain === this.SHORTENER_DOMAIN) {
      this._setErrMsg(urlParts, 'DOMAIN_EQ');
      return urlParts.error;
    }
    if (this.LONG_ACCESS[urlParts.domainRest]) {
      this.LONG_ACCESS[urlParts.domainRest].active = true;
      return { value: urlParts.scheme + this.LONG_ACCESS[urlParts.domainRest].shortUrl }
    };
    let shortUrl;
    if (this.SHORT_ACCESS[urlParts.domainRest]) {
      shortUrl = this.SHORT_ACCESS[urlParts.domainRest].shortUrl;
    } else { 
      shortUrl = this.SHORTENER_DOMAIN+'/'+Math.floor(Math.random()*2**32).toString(36);
    }
    let urlInfo = { longUrl: urlParts.domainRest, shortUrl: shortUrl, active: true, queries: 0};
    this.LONG_ACCESS[urlInfo.longUrl] = urlInfo;
    this.SHORT_ACCESS[urlInfo.shortUrl] = urlInfo;
    return { value: urlParts.scheme + shortUrl};
  }
  
  /** The argument shortUrl must be a shortened URL previously
   *  returned by the add() method which has not subsequently been
   *  removed by the remove() method.
   *
   *  If there are no errors, then return an object having a 'value'
   *  property which contains the long url corresponding to shortUrl.
   *
   *  Errors corresponding to the following 'code's should be
   *  detected:
   *
   *   'URL_SYNTAX': shortUrl syntax is incorrect (it does not contain
   *                 a :// substring or the domain is empty.
   *
   *   'DOMAIN':     shortUrl domain is not equal to SHORTENER_DOMAIN.
   *
   *   'NOT_FOUND':  shortUrl is not currently registered for this
   *                 service.
   */
  query(shortUrl) {
    let urlParts = this._getUrlParts(shortUrl);
    if (urlParts.error) { return urlParts.error; }
    if (urlParts.domain !== this.SHORTENER_DOMAIN) {
      this._setErrMsg(urlParts, 'DOMAIN_NE');
      return urlParts.error;
    }
    if (!this.SHORT_ACCESS[urlParts.domainRest] || !this.SHORT_ACCESS[urlParts.domainRest].active) {
      this._setErrMsg(urlParts, 'NOT_FOUND');
      return urlParts.error;
    }
    this.SHORT_ACCESS[urlParts.domainRest].queries++;
    return { value: urlParts.scheme + this.SHORT_ACCESS[urlParts.domainRest].longUrl };
  }


  /** The argument url must be one of a previously added (longUrl,
   *  shortUrl) pair.  It may be the case that url is currently
   *  removed.
   *
   *  If there are no errors, then return an object having a 'value'
   *  property which contains a count of the total number of times
   *  shortUrl was successfully looked up using query().  Note that
   *  the count should be returned even if url is currently removed.
   *
   *  Errors corresponding to the following 'code's should be detected:
   *
   *   'URL_SYNTAX': url syntax is incorrect (it does not contain
   *                 a :// substring, or the domain is empty).
   *
   *   'NOT_FOUND':  url was never registered for this service.
   */
  count(url) {
    let urlParts = this._getUrlParts(url);
    if (urlParts.error) { return urlParts.error; }
    if (!this.LONG_ACCESS[urlParts.domainRest] && !this.SHORT_ACCESS[urlParts.domainRest]) {
      this._setErrMsg(urlParts, 'NOT_FOUND');
      return urlParts.error;
    }
    let query;
    if (this.LONG_ACCESS[urlParts.domainRest]) { query = this.LONG_ACCESS[urlParts.domainRest].queries; }
    else { query = this.SHORT_ACCESS[urlParts.domainRest].queries; }
    return { value: query }
  }

  /** The argument url must be one of a previously added (longUrl,
   *  shortUrl) pair.  It is not an error if the url has already
   *  been removed.
   *
   *  If there are no errors, then return an empty object and make the
   *  association between (longUrl, shortUrl) unavailable to
   *  future uses of the query() method.
   *
   *  Errors corresponding to the following 'code's should be detected:
   *
   *   'URL_SYNTAX':  url syntax is incorrect (it does not contain
   *                  a :// substring, or the domain is empty).
   *
   *   'NOT_FOUND':  url was never registered for this service.
   */
  remove(url) {
    let urlParts = this._getUrlParts(url);
    if (urlParts.error) { return urlParts.error; }
    if (!this.LONG_ACCESS[urlParts.domainRest] && !this.SHORT_ACCESS[urlParts.domainRest]) {
      this._setErrMsg(urlParts, 'NOT_FOUND');
      return urlParts.error;
    }
    if (this.LONG_ACCESS[urlParts.domainRest]) { this.LONG_ACCESS[urlParts.domainRest].active = false; }
    else { this.SHORT_ACCESS[urlParts.domainRest].active = false; }
    return {};
  }

  /** This method takes in a url input string and uses it to populate
   *  a urlParts object with information about the url's scheme, domain,
   *  rest, error message, whole url, and domainRest, which is just a 
   *  concatenation of the normalized domain and rest.
   *  This method returns the urlParts obkect that it populates.
   */
  _getUrlParts(url) {
    let retObj = { scheme: null, domain: null, rest: null, domainRest: null, error: null, url: url };
    let ind0 = url.indexOf('://')+3;
    if (ind0 === 2 || ind0 === 3 || url.length === ind0 || url[ind0] === '/') {
      this._setErrMsg(retObj, 'URL_SYNTAX');
      return retObj;
    }
    retObj.scheme = url.substring(0,ind0).toLowerCase();
    let ind1 = url.substring(ind0).indexOf('/');
    if (ind1 === -1) {
      retObj.domain = url.substring(ind0).toLowerCase();
      retObj.domainRest = retObj.domain;
    } else {
      retObj.domain = url.substring(ind0, ind0+ind1).toLowerCase();
      retObj.rest = url.substring(ind0+ind1);
      retObj.domainRest = retObj.domain+retObj.rest;
    }
    retObj.url = retObj.scheme+retObj.domainRest;
    return retObj;
  }

  /** This method takes a string and a urlParts object as a
   *  parameter and sets the error field of the
   *  urlParts object based on the error message string,
   *  using information from the other fields of 
   *  the urlParts object. This method has no return value.
   */
  _setErrMsg(urlParts, errMsg) {
    switch (errMsg) {
      case 'URL_SYNTAX':
        urlParts.error = { error: { code: 'URL_SYNTAX', message: `URL_SYNTAX: bad url ${urlParts.url}` } };
        break;
      case 'DOMAIN_EQ':
        urlParts.error = { error: { code: 'DOMAIN', message: `DOMAIN: domain ${urlParts.domain} equal to ${this.SHORTENER_DOMAIN}` } };
        break;
      case 'DOMAIN_NE':
        urlParts.error = { error: { code: 'DOMAIN', message: `DOMAIN: domain of url ${urlParts.domain} not equal to ${this.SHORTENER_DOMAIN}` } };
        break;
      case 'NOT_FOUND':
        urlParts.error = { error: { code: 'NOT_FOUND', message: `NOT_FOUND: ${urlParts.url} not found` } };
        break;
      default:
        urlParts.error = { error: { code: 'UNKNOWN', message: `UNKNOWN: unknown error, something went wrong :(` } };
    }
  }
}

//UrlShortener class as only export
module.exports = UrlShortener

