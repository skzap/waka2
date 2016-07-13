# Waka
Wiki engine with no server side database

## Features

- No server-side database. Virtually no operating costs.
- Articles are stored permanently client-side with IndexedDb.
- Markdown syntax.
- Download, compare and adopt different article variants.
- Create new articles from wikipedia api quickly.

## Demo
[Wakapedia](http://wakapedia.info/)
Wakapedia.info is a decentralized and truly collaborative encyclopedia.

## Install your own waka

1. Install the latest node and npm
2. Clone this git repository and install the dependencies with npm
    git clone https://github.com/skzap/waka2.git waka && cd waka && npm install
3. Start the signalling server and web server (express)
    npm start

Finally, visit (http://localhost:3000/) in your browser. You can edit the host and port in the config.json file.
