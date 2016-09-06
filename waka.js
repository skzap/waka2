var minimongo = require("minimongo")
var IndexedDb = minimongo.IndexedDb
var LocalDb = minimongo.MemoryDb
var Peer = require('peerjs')
var WakaConfig = require('./config.json')

Waka = {
  connect: function(options) {
    if (!options) options=WakaConfig.PeerServer
    Waka.c = new Peer(options)
    // loading peer protocol
    require('./peer.js')
  },
  db: new IndexedDb({namespace: 'waka'}),
  mem: new LocalDb()
}

Waka.db.addCollection('Articles')
Waka.mem.addCollection('Peers')
Waka.mem.addCollection('Search')
Waka.mem.addCollection('Variants')

// connecting to signalling server
Waka.c = null;
// adding api
Waka.api = require('./api.js')

var exports = module.exports = Waka;
