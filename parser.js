const fs = require('fs')

var PAGE_TITLE = ''
var PAGE_DESCRIPTION = ''
var SLUG_TO_PAGE = ''
var MY_DOMAIN = ''
var CUSTOM_SCRIPT = ''
var GOOGLE_FONT = ''

function init(config) {
  PAGE_TITLE = config.get('PAGE_TITLE')
  PAGE_DESCRIPTION = config.get('PAGE_DESCRIPTION')
  GOOGLE_FONT = config.get('GOOGLE_FONT')
  MY_DOMAIN = config.get('my_domain')
  const CUSTOM_SCRIPT_FILE = config.get('CUSTOM_SCRIPT_FILE')
  CUSTOM_SCRIPT = fs.readFileSync(CUSTOM_SCRIPT_FILE, 'utf8')
}

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

module.exports = {
  SLUG_TO_PAGE: SLUG_TO_PAGE,
  init: init,
  parseMeta: parseMeta,
  parseHead: parseHead,
  parseBody: parseBody
};
