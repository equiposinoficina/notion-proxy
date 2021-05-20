const { Client } = require('@notionhq/client');
var fs = require('fs');

const notion = new Client({ auth: NOTION_API });

(async () => {
  var json = {};
  json.page_slug = [];
  for (var [ dbName, dbId ] in Object.entries(DATABASE_IDS)) {
    const response = await notion.databases.query({
      database_id: DATABASE_IDS[dbId]
    });
    let slug = {};
    slug.page = 'https://www.notion.so/';
    for (var item in response.results) {
      slug.page += response.results[item].id.split('-').join('');
      slug.slug = dbName + "/";
      slug.slug += response.results[item].properties.slug.rich_text[0].plain_text;
      json.page_slug.push(slug);
    }
  }
  fs.writeFile('../cache/slugs.json', JSON.stringify(json), (e) => {
    if (e) {
      console.error(e);
    }
  })
})();