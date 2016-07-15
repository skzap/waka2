var minimongo = require("minimongo")
var IndexedDb = minimongo.IndexedDb
var LocalDb = minimongo.MemoryDb
var Peer = require('peerjs')
var Hashes = require('jshashes')
var WakaConfig = require('./config.json')

Waka = {
  db: new IndexedDb({namespace: 'waka'}),
  memory: new LocalDb()
}

Waka.db.addCollection('Articles')
Waka.memory.addCollection('Peers')
Waka.memory.addCollection('Search')
Waka.memory.addCollection('Variants')

// connecting to peer to peer
Waka.c = new Peer(WakaConfig.PeerServer)

Waka.HashArticle = function(article) {
  var hash = new Hashes.MD5().hex(article.title)
  hash += new Hashes.MD5().hex(article.content)
  hash += new Hashes.MD5().hex(article.image)
  article._id = new Hashes.MD5().hex(hash)
  return article
}

// loading peer to peer network
require('./peer.js')
// loading UI
require('./ui.js')
