var minimongo = require("minimongo")
var IndexedDb = minimongo.IndexedDb
var LocalDb = minimongo.MemoryDb
var Peer = require('peerjs')
var WakaConfig = require('./config.json')

Waka = {
  db: new IndexedDb({namespace: 'waka'}),
  mem: new LocalDb()
}

Waka.db.addCollection('Articles')
Waka.mem.addCollection('Peers')
Waka.mem.addCollection('Search')
Waka.mem.addCollection('Variants')

// connecting to signalling server
Waka.c = new Peer(WakaConfig.PeerServer)
// loading peer protocol
require('./peer.js')
// adding api
Waka.api = require('./api.js')
