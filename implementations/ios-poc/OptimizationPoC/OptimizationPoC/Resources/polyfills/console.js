var console = {
  log: function () {
    __nativeLog('log', Array.prototype.slice.call(arguments).join(' '))
  },
  warn: function () {
    __nativeLog('warn', Array.prototype.slice.call(arguments).join(' '))
  },
  error: function () {
    __nativeLog('error', Array.prototype.slice.call(arguments).join(' '))
  },
  info: function () {
    __nativeLog('info', Array.prototype.slice.call(arguments).join(' '))
  },
  debug: function () {
    __nativeLog('debug', Array.prototype.slice.call(arguments).join(' '))
  },
}
