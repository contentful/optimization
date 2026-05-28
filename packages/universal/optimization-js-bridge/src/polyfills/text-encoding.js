if (typeof TextEncoder === 'undefined') {
  var TextEncoder = (function () {
    function TE() {
      this.encoding = 'utf-8'
    }
    TE.prototype.encode = function (str) {
      var arr = []
      for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i)
        if (c < 128) {
          arr.push(c)
        } else if (c < 2048) {
          arr.push(192 | (c >> 6), 128 | (c & 63))
        } else {
          arr.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63))
        }
      }
      return new Uint8Array(arr)
    }
    return TE
  })()
}

if (typeof TextDecoder === 'undefined') {
  var TextDecoder = (function () {
    function TD() {
      this.encoding = 'utf-8'
    }
    TD.prototype.decode = function (buf) {
      var arr = new Uint8Array(buf)
      var result = ''
      for (var i = 0; i < arr.length; i++) {
        result += String.fromCharCode(arr[i])
      }
      return result
    }
    return TD
  })()
}
