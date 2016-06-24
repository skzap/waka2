// this server serves the html app
// also runs the peer js connection broker server
var winston = require('winston')
winston.add(winston.transports.File, { filename: 'logs.log' });
var express = require('express')
var app = express()
var path    = require("path")
var ExpressPeerServer = require('peer').ExpressPeerServer

var serverOptions = {
    debug: true,
    allow_discovery: true
}

var server = app.listen(80)
console.log('Signalling server online')
app.use(express.static('public'))
app.use('/peerjs', ExpressPeerServer(server, serverOptions))
app.use('/', express.static('output'));


server.on('connection', function(conn) {
	//winston.info('Socket opened: ' + conn.id)
	//conn.send('hi');
})

server.on('disconnect', function(conn) {
	// client disconnected
});
