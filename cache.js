var cache = {}
var CACHE_TTL = 0

var cron = require('node-cron')
cron.schedule('45 * * * *', function() {
  console.log('every hour')
  let now = new Date().getTime()
  for (var item in cache) {
    if (now > cache[item].ts + (CACHE_TTL * 1000)) {
      delete cache[item]
      console.log('[CACHE] removed: ', item)
    }
  }
})

function hashkey (url) {
  return url
  let shasum = crypto.createHash('sha1')
  shasum.update(url)
  return shasum.digest('hex')
}

function save( meta, body) {
  const key = hashkey(meta.finalUrl)
  cache[key] = {}
  cache[key].body = body
  cache[key].ts = new Date().getTime()
}

function load(url) {
  const key = hashkey(url)
  if (key in cache) {
    return cache[key].body
  }
  return null
}

module.exports = {
  CACHE_TTL: CACHE_TTL,
  hashkey: hashkey,
  save: save,
  load: load
};
