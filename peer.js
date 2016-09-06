// connecting to network and adding a bunch of peers
Waka.c.on('open', function(id) {
	Waka.api.Emitter.emit('connected');
	Waka.c.listAllPeers(function(p) {
		for (var i = 0; i < p.length && i < 50; i++) {
			if (Waka.c.id != p[i])
				handshakePeer(Waka.c.connect(p[i]))
		}
	})
})

// allowing people to connect to us
Waka.c.on('connection', handshakePeer)

Waka.c.broadcast = function(message, exceptions) {
	Waka.mem.Peers.find({},{}).fetch(function(p){
    for (var i = 0; i < p.length; i++) {
			if (exceptions && exceptions.indexOf(p[i]._id) > -1) break
			Waka.c.messageToPeer(p[i]._id, message)
    }
	})
}

Waka.c.messageToPeer = function(peerId, message) {
	console.log('OUT', peerId, message.c, message.data)
  for (var y = 0; y < Waka.c.connections[peerId].length; y++) {
    Waka.c.connections[peerId][y].send(message)
  }
}

function savePeer(id, index) {
  Waka.mem.Peers.upsert({_id: id, index: index})
	Waka.api.Emitter.emit('peerchange');
}

function updateIndex(id, indexRow) {
	if (!Waka.mem.Peers || !Waka.mem.Peers.items || !Waka.mem.Peers.items[id].index) return false
	var updated = false
	for (var i = 0; i < Waka.mem.Peers.items[id].index.length; i++) {
		if (Waka.mem.Peers.items[id].index[i].title == indexRow.title) {
			Waka.mem.Peers.items[id].index[i]._id = indexRow._id
			updated = true
			Waka.api.Emitter.emit('peerchange');
		}
	}
	if (!updated) {
		Waka.mem.Peers.items[id].index.push(indexRow)
	}
}

function deletePeer(id) {
  Waka.mem.Peers.remove(id)
	Waka.api.Emitter.emit('peerchange');
}

function handshakePeer(conn) {
	conn.on('open', function(){
    Waka.mem.Peers.findOne({_id: conn.peer}, {}, function(match) {
      if (!match) savePeer(conn.peer)
    })

		// send our indexes to our peers as handshake
    Waka.db.Articles.find({},{fields: {_id:1, title: 1}}).fetch(function(res){
      conn.send({c:'index', data:res})
    })
	})
	conn.on('close', function(){
		// may we meet again
    Waka.mem.Peers.findOne({_id: conn.peer}, {}, function(match) {
      if (match) deletePeer(conn.peer)
    })
	})
  conn.on('data', function(res){
		console.log('IN', conn.peer, res.c, res.data)
  	switch(res.c) {
			case 'index':
				// if he has an article we are searching for, sending search to him
				Waka.mem.Search.findOne({origin: Waka.c.id}, {}, function(search) {
					if (!search) return
					for (var i = 0; i < res.data.length; i++) {
						if (res.data[i].title == search.title) {
							Waka.c.messageToPeer(conn.peer, {c:'search', data: {title:search.title, origin:Waka.c.id} })
						}
					}
				})
				// saving the index of the new peer
        savePeer(conn.peer, res.data)
  			break
			case 'download':
				Waka.db.Articles.findOne({_id: res.data._id},{}, function(art) {
					if (art) Waka.c.messageToPeer(conn.peer, {c:'sharevar', data: art})
				})
  			break
  		case 'search':
				// someone is searching
				Waka.mem.Search.findOne({title: res.data.title, origin: res.data.origin}, {}, function(match) {
					if (!match) {
						// we havent processed this search yet, doing so now
						var re = new RegExp("^"+res.data.title+"$", 'i');
						Waka.db.Articles.findOne({title: re},{}, function(art) {
							if (!art) {
								Waka.mem.Search.upsert({title: res.data.title, origin: res.data.origin})
								// not in our database, looking into our peer index
								Waka.mem.Peers.find({},{}).fetch(function(p){
									var found = false
							    for (var i = 0; i < p.length; i++) {
										if (!p[i].index) continue
										for (var y = 0; y < p[i].index.length; y++) {
											if (p[i].index[y].title == res.data.title) {
												// article found for peer p, forwarding search
												Waka.c.messageToPeer(p[i]._id, res)
												found = true
											}
										}
							    }
									if (!found && res.data.echo > 0 && res.data.echo < 3) {
										// not found anywhere around, broadcasting search
										res.data.echo--
										Waka.c.broadcast(res, [res.data.origin, conn.peer])
									}
							  })
							} else {
								// we got this
								Waka.mem.Peers.findOne({_id: res.data.origin},{}, function(peerMatch) {
									if (!peerMatch) handshakePeer(Waka.c.connect(res.data.origin))
									else {
										Waka.mem.Search.upsert({title: res.data.title, origin: res.data.origin})
										Waka.c.messageToPeer(res.data.origin, {c:'share', data: art})
									}
								})
							}
						})
					}
				})
  			break
  		case 'share':
			  // someone is sending us an article
				var re = new RegExp("^"+res.data.title+"$", 'i');
        Waka.mem.Search.findOne({title: re, origin: Waka.c.id}, {}, function(match) {
          if (match) {
						Waka.mem.Search.remove(match._id, function() {
							Waka.db.Articles.findOne({title: re},{},function(matchA) {
								if (!matchA) {
									if (res.data._id !== Waka.api.Hash(res.data.title, res.data.content)._id){
										console.log('Non-matching hash transmitted')
										return
									}
									Waka.api.Set(res.data.title, res.data.content, function(e, r) {
										Waka.api.Emitter.emit('newshare', r.triplet);
									})
								}	else {
									Waka.mem.Variants.upsert(res.data, function() {

									})
								}
							})
						})
          }
        })
  			break
			case 'sharevar':
			  // someone is sending us a variant
				Waka.mem.Search.findOne({variant: res.data._id, origin: Waka.c.id}, {}, function(search) {
	        if (!search) return
					Waka.mem.Search.remove(search._id, function() {
						Waka.mem.Variants.upsert(res.data, function(res) {
							Waka.api.Emitter.emit('newsharevar', res);
						})
					})
	      })
  			break
			case 'indexchange':
			  // someone updated a line of his index
				updateIndex(conn.peer, res.data)
  			break
  	}
  })
}
