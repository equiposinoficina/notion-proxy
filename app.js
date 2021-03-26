var crypto = require('crypto')
var sslRootCAs = require('ssl-root-cas/latest')
sslRootCAs.inject()
const fetch = require('fetch').fetchUrl
const mime = require('mime-types')
const jsdom = require("jsdom")
const { JSDOM } = jsdom
var cors = require('cors')
const express = require('express')
const bodyParser = require('body-parser')
const app = express()
app.use(cors())
app.use(express.raw({ type: "application/json" }))
const config = require('config')

const host = config.get('host')
const port = config.get('port')
const MY_DOMAIN = config.get('my_domain')
const SLUG_TO_PAGE = config.get('SLUG_TO_PAGE')
const PAGE_TITLE = config.get('PAGE_TITLE')
const PAGE_DESCRIPTION = config.get('PAGE_DESCRIPTION')
const GOOGLE_FONT = config.get('GOOGLE_FONT')
const CUSTOM_SCRIPT_FILE = config.get('CUSTOM_SCRIPT_FILE')
const ROBOTS_FILE = config.get('ROBOTS_FILE')
const CACHE_TTL = config.get('CACHE_TTL')

var fs = require('fs');

const CUSTOM_SCRIPT = fs.readFileSync(CUSTOM_SCRIPT_FILE, 'utf8');
const ROBOTS = fs.readFileSync(ROBOTS_FILE, 'utf8');

var bwH;
var cache = {}
const PAGE_TO_SLUG = {}
const slugs = []
const pages = []
Object.keys(SLUG_TO_PAGE).forEach(slug => {
  const page = SLUG_TO_PAGE[slug]
  slugs.push(slug)
  pages.push(page)
  PAGE_TO_SLUG[page] = slug
})

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
  
function generateSitemap() {
  let sitemap = '<?xml version="1.0" encoding="utf-8"?>'
  sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">'
  slugs.forEach(
    (slug) =>
      (sitemap +=
        '<url><loc>https://' + MY_DOMAIN + '/' + slug + '</loc></url>')
  );
  sitemap += '</urlset>'
  return sitemap
}

app.get('/sitemap.xml', (req, res) => {
  res.set('Content-Type', 'application/xml; charset=utf-8')

  return res.send(generateSitemap())
})

function parseMeta(element) {
  try {
    if (PAGE_TITLE !== '') {
      if (element.getAttribute('property') === 'og:title'
        || element.getAttribute('name') === 'twitter:title') {
        element.setAttribute('content', PAGE_TITLE);
      }
      if (element.tagName === 'TITLE') {
        element.innerHTML = PAGE_TITLE;
        element.innerText = PAGE_TITLE;
      }
    }
    if (PAGE_DESCRIPTION !== '') {
      if (element.getAttribute('name') === 'description'
        || element.getAttribute('property') === 'og:description'
        || element.getAttribute('name') === 'twitter:description') {
        element.setAttribute('content', PAGE_DESCRIPTION);
      }
    }
    if (element.getAttribute('property') === 'og:url'
      || element.getAttribute('name') === 'twitter:url') {
      element.setAttribute('content', MY_DOMAIN);
    }
    if (element.getAttribute('name') === 'apple-itunes-app') {
      element.remove();
    }
  } catch (e) {
    console.log(e)
    process.exit(1)
  }
}
  
function parseHead (element) {
  if (GOOGLE_FONT !== '') {
    element.innerHTML += `<link href="https://fonts.googleapis.com/css?family=${GOOGLE_FONT.replace(' ', '+')}:Regular,Bold,Italic&display=swap" rel="stylesheet">
    <style>* { font-family: "${GOOGLE_FONT}" !important; }
    .notion-topbar { display: none; }
    .notion-selectable.notion-collection_view-block > div > div > div > a { display: none!important; }
    </style>`;
    // hide top-bar
    // hide top bar of gallery tables
  }

}

function parseBody (element) {
  element.innerHTML += `
  <script>
  const SLUG_TO_PAGE =  ${JSON.stringify(SLUG_TO_PAGE)};
  const PAGE_TO_SLUG = {};
  const slugs = [];
  const pages = [];
  const el = document.createElement('div');
  let redirected = false;
  Object.keys(SLUG_TO_PAGE).forEach(slug => {
    const page = SLUG_TO_PAGE[slug];
    slugs.push(slug);
    pages.push(page);
    PAGE_TO_SLUG[page] = slug;
  });
  function getPage() {
    return location.pathname.slice(-32);
  }
  function getSlug() {
    return location.pathname.slice(1);
  }
  function updateSlug() {
    const slug = PAGE_TO_SLUG[getPage()];
    if (slug != null) {
      history.replaceState(history.state, '', '/' + slug);
    }
  }
  const observer = new MutationObserver(function() {
    if (redirected) return;
    const nav = document.querySelector('.notion-topbar');
    const mobileNav = document.querySelector('.notion-topbar-mobile');
    if (nav && nav.firstChild && nav.firstChild.firstChild
      || mobileNav && mobileNav.firstChild) {
      redirected = true;
      updateSlug();
      const onpopstate = window.onpopstate;
      window.onpopstate = function() {
        if (slugs.includes(getSlug())) {
          const page = SLUG_TO_PAGE[getSlug()];
          if (page) {
            history.replaceState(history.state, 'bypass', '/' + page);
          }
        }
        onpopstate.apply(this, [].slice.call(arguments));
        updateSlug();
      };
    }
  });
  observer.observe(document.querySelector('#notion-app'), {
    childList: true,
    subtree: true,
  });
  const replaceState = window.history.replaceState;
  window.history.replaceState = function(state) {
    if (arguments[1] !== 'bypass' && slugs.includes(getSlug())) return;
    return replaceState.apply(window.history, arguments);
  };
  const pushState = window.history.pushState;
  window.history.pushState = function(state) {
    const dest = new URL(location.protocol + location.host + arguments[2]);
    const id = dest.pathname.slice(-32);
    if (pages.includes(id)) {
      arguments[2] = '/' + PAGE_TO_SLUG[id];
    }
    return pushState.apply(window.history, arguments);
  };
  const open = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function() {
    arguments[1] = arguments[1].replace('${MY_DOMAIN}', 'www.notion.so');
    return open.apply(this, [].slice.call(arguments));
  };
  <!-- required for comments identification -->
  document.notionPageID = getPage();
</script>${CUSTOM_SCRIPT}`
}

function parse (document) {
  let title = document.querySelector('title')
  parseMeta(title)
  
  let metas = document.querySelectorAll('meta')
  for (var  m = 0; m < metas.length; m++) {
    parseMeta(metas[m])
  }
  
  let head = document.querySelector('head')
  parseHead(head)
  
  let tagBody = document.querySelector('body')
  parseBody(tagBody)
  
}

function cache_hashkey (url) {
  return url
  let shasum = crypto.createHash('sha1')
  shasum.update(url)
  return shasum.digest('hex')
}

function cache_save( meta, body) {
  const key = cache_hashkey(meta.finalUrl)
  cache[key] = {}
  cache[key].body = body
  cache[key].ts = new Date().getTime()
}

function cache_load(url) {
  const key = cache_hashkey(url)
  if (key in cache) {
    return cache[key].body
  }
  return null
}

app.get('/robots.txt', (req, res) => {
  res.set('Content-Type', 'text/plain')

  return res.send(ROBOTS)
})

app.get('*', (req, res) => {
  let url = 'https://www.notion.so'
  let uri = req.originalUrl.substring(1)
  console.log('uri', req.originalUrl)
  if (SLUG_TO_PAGE.hasOwnProperty(uri)) {
    url += '/' + SLUG_TO_PAGE[uri]
    console.log('redirect', uri, url)
    return res.redirect(301, '/' + SLUG_TO_PAGE[uri])
  } else if (req.originalUrl.startsWith('/image/https:/')) {
    let uri = req.originalUrl.replace('https:/s3','https://s3')
    const sub_url = uri.substring(7)
    const sub_url_noparam = sub_url.split('?')[0]
    const sub_url_param = sub_url.split('?')[1]
    url += '/image/' + encodeURIComponent(sub_url_noparam) + '?' + sub_url_param
  } else url += req.originalUrl

  console.log('proxy_pass', url)

  
  bwH = req.headers
  delete bwH['host']
  delete bwH['referer']
    res.headers = bwH
  let ct = mime.lookup(req.originalUrl)
  if (!ct) ct = 'text/html'
  res.set('Content-Type', ct)
  res.removeHeader('Content-Security-Policy')
  res.removeHeader('X-Content-Security-Policy')
  
  const c = cache_load(url)
  if (c) {
    console.log('tornem cache')
    return res.send(c)
  }
  return fetch(url, {
    payload: req.body.toString(), 
    headers: bwH,
    rejectUnauthorized: false,
    redirect: 'follow',
    method: 'GET',
    }, (error, meta, body) => {
    if (req.originalUrl.startsWith('/app') && req.originalUrl.endsWith('js')) {
      res.set('Content-Type', 'application/x-javascript')
      body = body.toString().replace(/www.notion.so/g, MY_DOMAIN).replace(/notion.so/g, MY_DOMAIN)
      cache_save(meta, body)
      return res.send(body)
    } else if (req.originalUrl.endsWith('css') || req.originalUrl.endsWith('js')) {
      const bs = body.toString()
      cache_save(meta, bs)
      return res.send(bs)
    } else {
      if (meta === undefined) {
        cache_save(meta, body)
        return res.send(body)
      }
      if (meta.responseHeaders['content-type'].includes('text/')) {
        const dom = new JSDOM(body.toString(), { includeNodeLocations: true })
        parse(dom.window.document)
        const ds = dom.serialize()
        cache_save(meta, ds)
        return res.send(ds)
      } else {
        cache_save(meta, body)
        return res.send(body)
      }
    }
  })

})

app.post('*', (req, res) => {
  const url = 'https://notion.so' + req.originalUrl
  const oldBody = req.body.toString()
  if (req.originalUrl.startsWith('/api')) {
    fetch(url, {
      payload: oldBody,
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.163 Safari/537.36'
      },
      method: 'POST',
      },(error, meta, body) => {
        let out = "ERROR"
        if (body !== undefined) out = body.toString()
        return res.send(out)
    })
  }
})


app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})

process.on('uncaughtException', err => {
  console.log(`Uncaught Exception: ${err.message}`)
  process.exit(1)
})
