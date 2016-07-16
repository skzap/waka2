// connecting to network and adding a bunch of peers
Waka.c.on('open', function(id) {
	Waka.Templates.Network.set('myId', Waka.c.id)
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
	Waka.memory.Peers.find({},{}).fetch(function(p){
    for (var i = 0; i < p.length; i++) {
			if (exceptions && exceptions.indexOf(p[i]._id) > -1) break
      for (var y = 0; y < Waka.c.connections[p[i]._id].length; y++) {
        Waka.c.connections[p[i]._id][y].send(message)
      }
    }
	})
}

Waka.c.messageToPeer = function(peerId, message) {
  for (var y = 0; y < Waka.c.connections[peerId].length; y++) {
    Waka.c.connections[peerId][y].send(message)
  }
}

function savePeer(id, index) {
  Waka.memory.Peers.upsert({_id: id, index: index})
  Waka.Templates.Network.refresh()
}

function updateIndex(id, indexRow) {
	if (!Waka.memory.Peers || !Waka.memory.Peers.items || !Waka.memory.Peers.items[id].index) return false
	var updated = false
	for (var i = 0; i < Waka.memory.Peers.items[id].index.length; i++) {
		if (Waka.memory.Peers.items[id].index[i].title == indexRow.title) {
			Waka.memory.Peers.items[id].index[i]._id = indexRow._id
			updated = true
		}
	}
	if (!updated) {
		Waka.memory.Peers.items[id].index.push(indexRow)
		Waka.Templates.Network.refresh()
	}
}

function deletePeer(id) {
  Waka.memory.Peers.remove(id)
  Waka.Templates.Network.refresh()
}

function handshakePeer(conn) {
	conn.on('open', function(){
    Waka.memory.Peers.findOne({_id: conn.peer}, {}, function(match) {
      if (!match) savePeer(conn.peer)
    })

		// send our indexes to our peers as handshake
    Waka.db.Articles.find({},{fields: {_id:1, title: 1}}).fetch(function(res){
      conn.send({c:'index', data:res})
    })
	})
	conn.on('close', function(){
		// may we meet again
    Waka.memory.Peers.findOne({_id: conn.peer}, {}, function(match) {
      if (match) deletePeer(conn.peer)
    })
	})
  conn.on('data', function(res){
		console.log(conn.peer, res.c, res.data)
  	switch(res.c) {
			case 'index':
				// if he has an article we are searching for, sending search to him
				Waka.memory.Search.findOne({origin: Waka.c.id}, {}, function(search) {
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
				Waka.memory.Search.findOne({title: res.data.title, origin: res.data.origin}, {}, function(match) {
					if (!match) {
						// we havent processed this search yet, doing so now
						var re = new RegExp("^"+res.data.title+"$", 'i');
						Waka.db.Articles.findOne({title: re},{}, function(art) {
							if (!art) {
								Waka.memory.Search.upsert({title: res.data.title, origin: res.data.origin})
								// not in our database, looking into our peer index
								Waka.memory.Peers.find({},{}).fetch(function(p){
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
								Waka.memory.Peers.findOne({_id: res.data.origin},{}, function(peerMatch) {
									if (!peerMatch) handshakePeer(Waka.c.connect(res.data.origin))
									else {
										Waka.memory.Search.upsert({title: res.data.title, origin: res.data.origin})
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
        Waka.memory.Search.findOne({title: re, origin: Waka.c.id}, {}, function(match) {
          if (match) {
						Waka.memory.Search.remove(match._id, function() {
							Waka.db.Articles.findOne({title: re},{},function(matchA) {
								if (!matchA)
									Waka.AddNewArticle(res.data.title, res.data.content, res.data.image, res.data._id, function() {
										Waka.Templates.Article.refreshArticleTemplate(res.data)
									})
								else {
									Waka.memory.Variants.upsert(res.data, function() {

									})
								}
							})
						})
          }
        })
  			break
			case 'sharevar':
			  // someone is sending us a variant
				Waka.memory.Search.findOne({variant: res.data._id, origin: Waka.c.id}, {}, function(search) {
	        if (!search) return
					Waka.memory.Search.remove(search._id, function() {
						Waka.memory.Variants.upsert(res.data, function() {
							Waka.Templates.Article.showVariants()
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
