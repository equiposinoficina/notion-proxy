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
app.use(bodyParser.raw({ type: "application/json" }))
const config = require('config')

const host = config.get('host')
const port = config.get('port')
const MY_DOMAIN = config.get('my_domain')
const SLUG_TO_PAGE = config.get('SLUG_TO_PAGE')
const PAGE_TITLE = config.get('PAGE_TITLE')
const PAGE_DESCRIPTION = config.get('PAGE_DESCRIPTION')
const GOOGLE_FONT = config.get('GOOGLE_FONT')
const CUSTOM_SCRIPT = config.get('CUSTOM_SCRIPT')

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
cron.schedule('56 * * * *', function() {
  console.log('every hour')
  for (var url in cache) {
    console.log('fetch', url)

  }
})
  
function generateSitemap() {
  let sitemap = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  slugs.forEach(
    (slug) =>
      (sitemap +=
        '<url><loc>https://' + MY_DOMAIN + '/' + slug + '</loc></url>')
  );
  sitemap += '</urlset>';
  return sitemap;
}

function parseMeta(element) {
  try {
    if (PAGE_TITLE !== '') {
      if (element.getAttribute('property') === 'og:title'
        || element.getAttribute('name') === 'twitter:title') {
        element.setAttribute('content', PAGE_TITLE);
      }
      if (element.tagName === 'title') {
        element.setInnerContent(PAGE_TITLE);
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
    // console.log(e)
  }
}
  
function parseHead (element) {
  if (GOOGLE_FONT !== '') {
    element.innerHTML += `<link href="https://fonts.googleapis.com/css?family=${GOOGLE_FONT.replace(' ', '+')}:Regular,Bold,Italic&display=swap" rel="stylesheet">
    <style>* { font-family: "${GOOGLE_FONT}" !important; }</style>`;
  }
  element.innerHTML += `<style>
  div.notion-topbar > div > div:nth-child(3) { display: none !important; }
  div.notion-topbar > div > div:nth-child(4) { display: none !important; }
  div.notion-topbar > div > div:nth-child(5) { display: none !important; }
  div.notion-topbar > div > div:nth-child(6) { display: none !important; }
  div.notion-topbar-mobile > div:nth-child(3) { display: none !important; }
  div.notion-topbar-mobile > div:nth-child(4) { display: none !important; }
  div.notion-topbar > div > div:nth-child(1n).toggle-mode { display: block !important; }
  div.notion-topbar-mobile > div:nth-child(1n).toggle-mode { display: block !important; }
  </style>`
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
  function onDark() {
    el.innerHTML = '<div style="margin-left: auto; margin-right: 14px; min-width: 0px;"><div role="button" tabindex="0" style="user-select: none; transition: background 120ms ease-in 0s; cursor: pointer; border-radius: 44px;"><div style="display: flex; flex-shrink: 0; height: 14px; width: 26px; border-radius: 44px; padding: 2px; box-sizing: content-box; background: rgb(46, 170, 220); transition: background 200ms ease 0s, box-shadow 200ms ease 0s;"><div style="width: 14px; height: 14px; border-radius: 44px; background: white; transition: transform 200ms ease-out 0s, background 200ms ease-out 0s; transform: translateX(12px) translateY(0px);"></div></div></div></div>';
    document.body.classList.add('dark');
    __console.environment.ThemeStore.setState({ mode: 'dark' });
  };
  function onLight() {
    el.innerHTML = '<div style="margin-left: auto; margin-right: 14px; min-width: 0px;"><div role="button" tabindex="0" style="user-select: none; transition: background 120ms ease-in 0s; cursor: pointer; border-radius: 44px;"><div style="display: flex; flex-shrink: 0; height: 14px; width: 26px; border-radius: 44px; padding: 2px; box-sizing: content-box; background: rgba(135, 131, 120, 0.3); transition: background 200ms ease 0s, box-shadow 200ms ease 0s;"><div style="width: 14px; height: 14px; border-radius: 44px; background: white; transition: transform 200ms ease-out 0s, background 200ms ease-out 0s; transform: translateX(0px) translateY(0px);"></div></div></div></div>';
    document.body.classList.remove('dark');
    __console.environment.ThemeStore.setState({ mode: 'light' });
  }
  function toggle() {
    if (document.body.classList.contains('dark')) {
      onLight();
    } else {
      onDark();
    }
  }
  function addDarkModeButton(device) {
    const nav = device === 'web' ? document.querySelector('.notion-topbar').firstChild : document.querySelector('.notion-topbar-mobile');
    el.className = 'toggle-mode';
    el.addEventListener('click', toggle);
    nav.appendChild(el);
    onLight();
  }
  const observer = new MutationObserver(function() {
    if (redirected) return;
    const nav = document.querySelector('.notion-topbar');
    const mobileNav = document.querySelector('.notion-topbar-mobile');
    if (nav && nav.firstChild && nav.firstChild.firstChild
      || mobileNav && mobileNav.firstChild) {
      redirected = true;
      updateSlug();
      addDarkModeButton(nav ? 'web' : 'mobile');
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
  cache[key] = body
}

function cache_load(url) {
  const key = cache_hashkey(url)
  if (key in cache) return cache[key]
  return null
}


app.get('*', (req, res) => {
  let url = 'https://www.notion.so'
  let uri = req.originalUrl.substring(1)
  console.log('uri', req.originalUrl)
  if (SLUG_TO_PAGE.hasOwnProperty(uri)) {
    url += '/' + SLUG_TO_PAGE[uri]
    console.log('redirect', uri, url)
    return res.redirect(301, '/' + SLUG_TO_PAGE[uri])
  }  
  else url += req.originalUrl

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
        return res.send(body.toString())
    })
  }
})


app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
