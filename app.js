const fetch = require('fetch').fetchUrl
const mime = require('mime-types')
const JSDOM = require("jsdom").JSDOM
const fs = require('fs')
const cors = require('cors')
const compression = require('compression')
const express = require('express')
const cache = require('./cache');
const parser = require('./parser');
var cron = require('node-cron')

// var crypto = require('crypto')
const sslRootCAs = require('ssl-root-cas/latest')
sslRootCAs.inject()

const config = require('config')
parser.init(config)
const server_host = config.get('host')
const server_port = config.get('port')
const MY_DOMAIN = config.get('my_domain')
const SLUG_CACHE = config.has('SLUG_CACHE') ? config.get('SLUG_CACHE') : ""
var SLUG_TO_PAGE = config.get('SLUG_TO_PAGE')

const ROBOTS_FILE = config.get('ROBOTS_FILE')
cache.setTTL(config.get('CACHE_TTL'))

const ROBOTS = fs.readFileSync(ROBOTS_FILE, 'utf8')

var bwH;
var PAGE_TO_SLUG = {};
Object.keys(SLUG_TO_PAGE).forEach(slug => {
  let page = SLUG_TO_PAGE[slug];
  PAGE_TO_SLUG[page] = slug;
})

var PERMA_TO_PAGE = {};

function parse_slug() {
  var aux = {}
  try {
    const fslugs = fs.readFileSync(SLUG_CACHE, 'utf8')
    const jslugs = JSON.parse(fslugs)
    Object.keys(jslugs['page_slug']).forEach(i => {
      let page = jslugs['page_slug'][i];
      const slug = page['slug'];
      const uid = page['page'].split('-').pop();
      const perma_link = page['perma_link'];
      PAGE_TO_SLUG[uid] = slug;
      aux[slug] = uid;
      PERMA_TO_PAGE[perma_link] = uid;
    })
  } catch (e) {
    console.info(`No slug cache file or format missmatch: ${SLUG_CACHE}`)
  }
  return aux;
}

let s = parse_slug();
console.log(s);

SLUG_TO_PAGE = {...SLUG_TO_PAGE, ...s}
parser.setSlugToPage(SLUG_TO_PAGE)

cron.schedule('0 0 * * *', function() {
  console.log('every day')
  SLUG_TO_PAGE = {...SLUG_TO_PAGE, ...parse_slug()}
  parser.setSlugToPage(SLUG_TO_PAGE)
})


const app = express()
app.use(compression())
app.use(cors())
app.use(express.raw({ type: "application/json" }))

app.listen(server_port, server_host, () => {
  console.log(`Example app listening at http://${server_host}:${server_port}`)
})

process.on('uncaughtException', err => {
  console.log(`Uncaught Exception: ${err.message}`)
  process.exit(1)
})

function RedirectException(message) {
  this.message = message;
  this.name = "RedirectException";
}

function parse (document) {
  let title = document.querySelector('title')
  if (title) parser.parseMeta(title)
  
  let metas = document.querySelectorAll('meta')
  for (var  m = 0; m < metas.length; m++) {
    parser.parseMeta(metas[m])
  }
  
  let head = document.querySelector('head')
  if (head) parser.parseHead(head)
  
  let tagBody = document.querySelector('body')
  if (tagBody) parser.parseBody(tagBody)
  
}

function generateSitemap() {
  let sitemap = '<?xml version="1.0" encoding="utf-8"?>'
  sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">'
  for (var slug in SLUG_TO_PAGE) {
      sitemap += '<url><loc>https://' + MY_DOMAIN + '/' + slug + '</loc></url>'
  };
  sitemap += '</urlset>'
  return sitemap
}

function get_notion_url(req, res) {
  let url = 'https://www.notion.so'
  let uri = req.originalUrl.substring(1)
  console.log('uri', req.originalUrl)
  if (PERMA_TO_PAGE.hasOwnProperty(uri)) {
    url = PERMA_TO_PAGE[uri].split('/').pop();
    console.log('redirect', uri, url);
    throw new RedirectException(url);
  } else if (SLUG_TO_PAGE.hasOwnProperty(uri)) {
    url = SLUG_TO_PAGE[uri].split('/').pop();
    console.log('redirect', uri, url)
    throw new RedirectException(url);
  } else if (req.originalUrl.startsWith('/image/https:/')) {
    let uri = req.originalUrl.replace('https:/s3','https://s3')
    const sub_url = uri.substring(7)
    const sub_url_noparam = sub_url.split('?')[0]
    const sub_url_param = sub_url.split('?')[1]
    url += '/image/' + encodeURIComponent(sub_url_noparam) + '?' + sub_url_param
  } else url += req.originalUrl

  return url
}

function create_response(error, meta, body, req, res) {
  if (req.originalUrl.startsWith('/app') && req.originalUrl.endsWith('js')) {
    res.set('Content-Type', 'application/x-javascript')
    body = body.toString().replace(/www.notion.so/g, MY_DOMAIN).replace(/notion.so/g, MY_DOMAIN)
  } else if (req.originalUrl.endsWith('css') || req.originalUrl.endsWith('js')) {
    body = body.toString()
  } else if (meta !== undefined && meta.responseHeaders['content-type'].includes('text/')) {
    const dom = new JSDOM(body.toString(), { includeNodeLocations: true })
    parse(dom.window.document)
    body = dom.serialize()
  }
  return body
}

app.get('/sitemap.xml', (req, res) => {
  res.set('Content-Type', 'application/xml; charset=utf-8')

  return res.send(generateSitemap())
})

app.get('/robots.txt', (req, res) => {
  res.set('Content-Type', 'text/plain')

  return res.send(ROBOTS)
})

app.get('*', (req, res) => {
  console.log(req.originalUrl)

  try {
    var url = get_notion_url(req, res)
    console.log('proxy_pass', url)
  } catch (e) {
    if (e instanceof RedirectException)
      return res.redirect(301, '/' + e.message);
    else
      res.status(500).send(e);
  }
  

  bwH = req.headers
  delete bwH['host']
  delete bwH['referer']
    res.headers = bwH
  let ct = mime.lookup(req.originalUrl)
  if (!ct) ct = 'text/html'
  res.set('Content-Type', ct)
  res.removeHeader('Content-Security-Policy')
  res.removeHeader('X-Content-Security-Policy')
  
  const c = cache.load(url)
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
      body = create_response(error, meta, body, req, res);
      cache.save(meta, body);
      return res.send(body);
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
