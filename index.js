var sslRootCAs = require('ssl-root-cas/latest')
sslRootCAs.inject()
const fetch = require('fetch').fetchUrl
const mime = require('mime-types')
const jsdom = require("jsdom")
const { JSDOM } = jsdom
var cors = require('cors')
const express = require('express')
const app = express()
app.use(cors())
const config = require('config')

const host = config.get('host')
const port = config.get('port')
const MY_DOMAIN = config.get('my_domain')
const SLUG_TO_PAGE = config.get('SLUG_TO_PAGE')
const PAGE_TITLE = config.get('PAGE_TITLE')
const PAGE_DESCRIPTION = config.get('PAGE_DESCRIPTION')
const GOOGLE_FONT = config.get('GOOGLE_FONT')
const CUSTOM_SCRIPT = config.get('CUSTOM_SCRIPT')

const PAGE_TO_SLUG = {};
const slugs = [];
const pages = [];
Object.keys(SLUG_TO_PAGE).forEach(slug => {
  const page = SLUG_TO_PAGE[slug];
  slugs.push(slug);
  pages.push(page);
  PAGE_TO_SLUG[page] = slug;
});
  
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
  
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
  
function handleOptions(request) {
  if (request.headers.get('Origin') !== null &&
    request.headers.get('Access-Control-Request-Method') !== null &&
    request.headers.get('Access-Control-Request-Headers') !== null) {
    // Handle CORS pre-flight request.
    return new Response(null, {
      headers: corsHeaders
    });
  } else {
    // Handle standard OPTIONS request.
    return new Response(null, {
      headers: {
        'Allow': 'GET, HEAD, POST, PUT, OPTIONS',
      }
    });
  }
}
  
async function fetchAndApply(request) {
  if (request.method === 'OPTIONS') {
    return handleOptions(request);
  }
  let url = new URL(request.url);
  url.hostname = 'www.notion.so';
  if (url.pathname === '/robots.txt') {
    return new Response('Sitemap: https://' + MY_DOMAIN + '/sitemap.xml');
  }
  if (url.pathname === '/sitemap.xml') {
    let response = new Response(generateSitemap());
    response.headers.set('content-type', 'application/xml');
    return response;
  }
  let fullPathname = request.url.replace("https://" + MY_DOMAIN, "");
  let response;
  if (url.pathname.startsWith('/app') && url.pathname.endsWith('js')) {
    response = await fetch(url.toString());
    let body = await response.text();
    response = new Response(body.replace(/www.notion.so/g, MY_DOMAIN).replace(/notion.so/g, MY_DOMAIN), response);
    response.headers.set('Content-Type', 'application/x-javascript');
    return response;
  } else if ((url.pathname.startsWith('/api'))) {
    // Forward API
    response = await fetch(url.toString(), {
      body: request.body,
      headers: {
        'content-type': 'application/json;charset=UTF-8',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.163 Safari/537.36'
      },
      method: 'POST',
    });
    response = new Response(response.body, response);
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } else if (slugs.indexOf(url.pathname.slice(1)) > -1) {
    const pageId = SLUG_TO_PAGE[url.pathname.slice(1)];
    return Response.redirect('https://' + MY_DOMAIN + '/' + pageId, 301);
  } else {
    response = await fetch(url.toString(), {
      body: request.body,
      headers: request.headers,
      method: request.method,
    });
    response = new Response(response.body, response);
    response.headers.delete('Content-Security-Policy');
    response.headers.delete('X-Content-Security-Policy');
  }

  return appendJavascript(response, SLUG_TO_PAGE);
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

function parseBody (SLUG_TO_PAGE, element) {
  element.innerHTML += `<div style="display:none">Powered by <a href="http://fruitionsite.com">Fruition</a></div>
  <script>
  const SLUG_TO_PAGE =  {"":"89f2d3ee8c1249b38840f65d9b1ad392"};
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
  parseBody(SLUG_TO_PAGE, tagBody)
  
}

var bwH;

app.get('*', (req, res) => {
  let url = 'https://www.notion.so'
  if (req.originalUrl === '/') url += '/89f2d3ee8c1249b38840f65d9b1ad392'
  else url += req.originalUrl
  console.log('proxy_pass', url)  
  bwH = req.headers
  delete bwH['host']
  delete bwH['referer']
  // console.log(bwH)
  res.headers = bwH
  let ct = mime.lookup(req.originalUrl)
  if (!ct) ct = 'text/html'
  res.set('Content-Type', ct)
  res.removeHeader('Content-Security-Policy')
  res.removeHeader('X-Content-Security-Policy')
  // console.log('get', req.originalUrl)

  return fetch(url, {
    body: req.body, 
    headers: bwH,
    rejectUnauthorized: false,
    redirect: 'follow',
    method: 'GET',
    }, (error, meta, body) => {
    if (req.originalUrl.startsWith('/app') && req.originalUrl.endsWith('js')) {
      res.set('Content-Type', 'application/x-javascript')
      body = body.toString().replace(/https:\/\/www.notion.so/g, 'http://' + MY_DOMAIN).replace(/https:\/\/notion.so/g, 'http://' + MY_DOMAIN)
      return res.send(body)
    } else if (req.originalUrl.endsWith('css') || req.originalUrl.endsWith('js')) {
      return res.send(body.toString())
    } else {
      // console.log(meta)
      const dom = new JSDOM(body.toString(), { includeNodeLocations: true })
      console.log('parse')
      parse(dom.window.document)
      return res.send(dom.serialize())
    }
  })

})

app.post('*', (req, res) => {
  const url = 'https://notion.so' + req.originalUrl
  // console.log('post', req.originalUrl)

  if (req.originalUrl.startsWith('/api')) {
    // console.log('proxy_pass', url)
    fetch(url, {
      body: req.body,
      headers: {
        'content-type': 'application/json;charset=UTF-8',
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
