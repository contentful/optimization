var URLSearchParams = (function () {
  function USP(init) {
    this._params = []
    if (typeof init === 'string') {
      var s = init.charAt(0) === '?' ? init.substring(1) : init
      if (s) {
        var pairs = s.split('&')
        for (var i = 0; i < pairs.length; i++) {
          var idx = pairs[i].indexOf('=')
          if (idx > -1) {
            this._params.push([
              decodeURIComponent(pairs[i].substring(0, idx)),
              decodeURIComponent(pairs[i].substring(idx + 1)),
            ])
          } else {
            this._params.push([decodeURIComponent(pairs[i]), ''])
          }
        }
      }
    }
  }
  USP.prototype.set = function (name, value) {
    for (var i = this._params.length - 1; i >= 0; i--) {
      if (this._params[i][0] === name) this._params.splice(i, 1)
    }
    this._params.push([name, value])
  }
  USP.prototype.get = function (name) {
    for (var i = 0; i < this._params.length; i++) {
      if (this._params[i][0] === name) return this._params[i][1]
    }
    return null
  }
  USP.prototype.has = function (name) {
    return this.get(name) !== null
  }
  USP.prototype.append = function (name, value) {
    this._params.push([name, value])
  }
  USP.prototype.delete = function (name) {
    for (var i = this._params.length - 1; i >= 0; i--) {
      if (this._params[i][0] === name) this._params.splice(i, 1)
    }
  }
  USP.prototype.toString = function () {
    return this._params
      .map(function (p) {
        return encodeURIComponent(p[0]) + '=' + encodeURIComponent(p[1])
      })
      .join('&')
  }
  USP.prototype.forEach = function (fn) {
    for (var i = 0; i < this._params.length; i++) {
      fn(this._params[i][1], this._params[i][0])
    }
  }
  return USP
})()

var URL = (function () {
  function URLPolyfill(urlStr, base) {
    var full = urlStr
    if (base && urlStr.indexOf('://') === -1) {
      var b = base.replace(/\/+$/, '')
      full = b + '/' + urlStr.replace(/^\/+/, '')
    }
    this.href = full

    var protocolEnd = full.indexOf('://')
    if (protocolEnd > -1) {
      this.protocol = full.substring(0, protocolEnd + 1)
      var rest = full.substring(protocolEnd + 3)
      var pathStart = rest.indexOf('/')
      if (pathStart > -1) {
        this.host = rest.substring(0, pathStart)
        var pathAndQuery = rest.substring(pathStart)
        var queryStart = pathAndQuery.indexOf('?')
        if (queryStart > -1) {
          this.pathname = pathAndQuery.substring(0, queryStart)
          this.search = pathAndQuery.substring(queryStart)
        } else {
          this.pathname = pathAndQuery
          this.search = ''
        }
      } else {
        this.host = rest
        this.pathname = '/'
        this.search = ''
      }
    } else {
      this.protocol = ''
      this.host = ''
      this.pathname = full
      this.search = ''
    }

    this.hostname = this.host.split(':')[0]
    this.origin = this.protocol ? this.protocol + '//' + this.host : ''
    this.searchParams = new URLSearchParams(this.search)
  }

  URLPolyfill.prototype.toString = function () {
    var qs = this.searchParams.toString()
    return this.origin + this.pathname + (qs ? '?' + qs : '')
  }

  return URLPolyfill
})()
