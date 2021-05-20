const fs = require('fs');
const request = require('request');
const config = require('config')

const PROJECT_TOKEN = config.get('PROJECT_TOKEN')
const API_KEY = config.get('API_KEY')

request({
  uri: 'https://parsehub.com/api/v2/projects/'+PROJECT_TOKEN+'/run',
  method: 'POST',
  gzip: true,
  qs: {
    api_key: API_KEY
  }
}, function(err, resp, body) {
  console.log(resp)
  console.log(body)
});