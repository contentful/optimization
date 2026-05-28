var __timerCallbacks = {}
var __nextTimerId = 1

function setTimeout(fn, delay) {
  var id = __nextTimerId++
  __timerCallbacks[id] = fn
  __nativeSetTimeout(id, delay || 0)
  return id
}

function clearTimeout(id) {
  delete __timerCallbacks[id]
  __nativeClearTimeout(id)
}

function __timerFired(id) {
  var fn = __timerCallbacks[id]
  delete __timerCallbacks[id]
  if (fn) fn()
}

var __intervalTimers = {}

function setInterval(fn, delay) {
  var intervalId = __nextTimerId++
  function repeat() {
    fn()
    if (intervalId in __intervalTimers) {
      __intervalTimers[intervalId] = setTimeout(repeat, delay)
    }
  }
  __intervalTimers[intervalId] = setTimeout(repeat, delay || 0)
  return intervalId
}

function clearInterval(id) {
  if (id in __intervalTimers) {
    clearTimeout(__intervalTimers[id])
    delete __intervalTimers[id]
  }
}
