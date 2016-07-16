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

// adding common functions to waka object
require('./commons.js')
// loading peer to peer network
require('./peer.js')
// loading UI
require('./ui.js')
