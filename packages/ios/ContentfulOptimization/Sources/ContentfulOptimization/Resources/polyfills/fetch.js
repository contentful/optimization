var __fetchCallbacks = {}
var __nextFetchId = 1

function fetch(input, init) {
  var url = typeof input === 'string' ? input : input.toString()
  var method = init && init.method ? init.method : 'GET'
  var headers = init && init.headers ? init.headers : {}
  var body = init && init.body ? init.body : null

  var headersJSON
  if (typeof headers === 'object' && headers !== null && typeof headers.forEach === 'function') {
    var h = {}
    headers.forEach(function (value, key) {
      h[key] = value
    })
    headersJSON = JSON.stringify(h)
  } else {
    headersJSON = JSON.stringify(headers)
  }

  var id = __nextFetchId++

  return new Promise(function (resolve, reject) {
    __fetchCallbacks[id] = { resolve: resolve, reject: reject }
    __nativeFetch(url, method, headersJSON, body, id)
  })
}

function __fetchComplete(id, statusCode, headersJSON, bodyText, errorMessage) {
  var cb = __fetchCallbacks[id]
  delete __fetchCallbacks[id]
  if (!cb) return

  if (errorMessage) {
    cb.reject(new Error(errorMessage))
    return
  }

  var responseHeaders = {}
  try {
    responseHeaders = JSON.parse(headersJSON || '{}')
  } catch (e) {}

  var response = {
    ok: statusCode >= 200 && statusCode < 300,
    status: statusCode,
    statusText: '' + statusCode,
    headers: {
      get: function (name) {
        var lower = name.toLowerCase()
        for (var key in responseHeaders) {
          if (key.toLowerCase() === lower) return responseHeaders[key]
        }
        return null
      },
      has: function (name) {
        return this.get(name) !== null
      },
      forEach: function (fn) {
        for (var key in responseHeaders) {
          fn(responseHeaders[key], key)
        }
      },
    },
    json: function () {
      try {
        return Promise.resolve(JSON.parse(bodyText))
      } catch (e) {
        return Promise.reject(e)
      }
    },
    text: function () {
      return Promise.resolve(bodyText)
    },
    clone: function () {
      return Object.assign({}, response)
    },
  }

  cb.resolve(response)
}
