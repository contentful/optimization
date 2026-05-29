var crypto = {
  randomUUID: function () {
    return __nativeRandomUUID()
  },
  getRandomValues: function (arr) {
    for (var i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256)
    }
    return arr
  },
}
