# notion-proxy
Turn your Notion pages into a Website with your URLs and customizations

# Clone and run

```bash
git clone https://github.com/equiposinoficina/notion-proxy.git
cd notion-proxy
npm install
node index.js
```

# Run using docker-compose

Assume you have docker-compose installed

```bash
docker-compose up -d
```

If you have any errors, just debug with:

```bash
docker-compose up
```


## Using nginx as reverse proxy and SSL with Let's encrypt

### http redirect to https
```
server {
    listen 80;
    server_name YOUR_DOMAIN.TLD;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
```

### reverse proxy for notion-proxy
```
server {
    listen 443 ssl;
    server_name YOUR_DOMAIN.TLD;

    ssl_certificate /etc/letsencrypt/live/YOUR_DOMAIN.TLD/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/YOUR_DOMAIN.TLD/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

     proxy_headers_hash_max_size 512;
     proxy_headers_hash_bucket_size 128; 

    location / {
        proxy_set_header Host $server_name;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto http;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header REMOTE_ADDR $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_pass http://127.0.0.1:3333/;

        add_header 'Access-Control-Allow-Origin' '*';
        add_header 'Access-Control-Allow-Credentials' 'true';
        add_header 'Access-Control-Allow-Headers' 'Authorization,Accept,Origin,DNT,X-CustomHeader,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Content-Range,Range';
        add_header 'Access-Control-Allow-Methods' 'GET,POST,OPTIONS,PUT,DELETE,PATCH';

        if ($request_method = 'OPTIONS') {
          add_header 'Access-Control-Allow-Origin' '*';
          add_header 'Access-Control-Allow-Credentials' 'true';
          add_header 'Access-Control-Allow-Headers' 'Authorization,Accept,Origin,DNT,X-CustomHeader,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Content-Range,Range';
          add_header 'Access-Control-Allow-Methods' 'GET,POST,OPTIONS,PUT,DELETE,PATCH';
          add_header 'Access-Control-Max-Age' 1728000;
          add_header 'Content-Type' 'text/plain charset=UTF-8';
          add_header 'Content-Length' 0;
          return 204;
        }

        # kill cache
        add_header Last-Modified $date_gmt;
        add_header Cache-Control 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0';
        if_modified_since off;
        expires off;
        etag off;
    }
}
```

# License
[GNU General Public License v3.0](https://github.com/equiposinoficina/notion-proxy/blob/main/LICENSE)

# Authors
https://equiposinoficina.com

Dani Aguayo - http://danielaguayo.com

Oriol Rius - https://oriolrius.me
