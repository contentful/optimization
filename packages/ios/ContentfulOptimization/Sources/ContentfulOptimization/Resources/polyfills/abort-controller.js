var AbortController = (function () {
  function AC() {
    this.signal = {
      aborted: false,
      reason: undefined,
      addEventListener: function () {},
      removeEventListener: function () {},
    }
  }
  AC.prototype.abort = function (reason) {
    this.signal.aborted = true
    this.signal.reason = reason || new Error('AbortError')
  }
  return AC
})()

var AbortSignal = {
  timeout: function (ms) {
    var ac = new AbortController()
    setTimeout(function () {
      ac.abort(new Error('TimeoutError'))
    }, ms)
    return ac.signal
  },
}
