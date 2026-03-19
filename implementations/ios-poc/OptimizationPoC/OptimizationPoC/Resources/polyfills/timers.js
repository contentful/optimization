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

function setInterval(fn, delay) {
  var id
  function repeat() {
    fn()
    id = setTimeout(repeat, delay)
  }
  id = setTimeout(repeat, delay || 0)
  return id
}

function clearInterval(id) {
  clearTimeout(id)
}
