const fs = require('fs');
const request = require('request');
const config = require('config')

const PROJECT_TOKEN = config.get('PROJECT_TOKEN')
const API_KEY = config.get('API_KEY')
const SLUGS_JSON = config.get('SLUGS_JSON')

request({
  uri: 'https://www.parsehub.com/api/v2/projects/'+PROJECT_TOKEN+'/last_ready_run/data ',
  method: 'GET',
  gzip: true,
  qs: {
    api_key: API_KEY,
    format: 'json'
  }
}, function(err, resp, body) {
  fs.writeFileSync(SLUGS_JSON, body, 'utf8')
});