// this server serves the html app
// also runs the peer js connection broker server
var WakaConfig = require('./config.json')
var express = require('express')
var app = express()
var path    = require("path")
var ExpressPeerServer = require('peer').ExpressPeerServer

var serverOptions = {
    debug: true,
    allow_discovery: true
}

var server = app.listen(WakaConfig.PeerServer.port)
console.log('Signalling server online')
app.use('/peerjs', ExpressPeerServer(server, serverOptions))
app.use('/', express.static('build'));


server.on('connection', function(conn) {})
server.on('disconnect', function(conn) {})
