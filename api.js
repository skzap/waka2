var Hashes = require('jshashes')

var exports = module.exports = {
  Hash: function(title, content) {
    var hash = new Hashes.MD5().hex(title+content)
    return {
      _id: hash,
      title: title,
      content: content
    }
  },
  Get: function(title, cb) {
    var re = new RegExp("^"+title+"$", 'i');
    Waka.db.Articles.findOne({title: re},{},function(match) {
      if (!match) cb('Not found', null)
      cb(null, match)
    })
  },
  Set: function(title, content, cb) {
    Waka.api.Get(title, function(e, match) {
      // ensuring uniqueness of title
      if (match) {
        // maybe add to variants in memory
        Waka.db.Articles.remove(match._id)
      }
      Waka.db.Articles.upsert(Waka.api.Hash(title,content), function() {
        // returns true is content was overwritten
        cb(null, match);
      })
    })

    // broadcasting our new hash for this article
    Waka.c.broadcast({
      c: 'indexchange',
      data: {_id: article._id, title: title}
    })
  },
  Search: function(title, hash) {
    console.log('Searching for',title,hash)

    // deletes all previous searches for this user? why ??
    Waka.mem.Search.find({origin: Waka.c.id},{}).fetch(function(s) {
      for (var i = 0; i < s.length; i++) {
        Waka.mem.Search.remove(s[i]._id)
      }
    })

    var search = {
      title: title,
      hash: hash,
      origin: Waka.c.id,
      echo: 2
    }
    Waka.mem.Search.upsert(search)
    Waka.c.broadcast({
      c:'search',
      data: search
    })
  },
  Index: function(cb) {
    Waka.db.Articles.find({},{fields: {_id:1, title: 1}}).fetch(function(res){
      cb(null, res)
    })
  }
};
