var Hashes = require('jshashes')
var ee = require('event-emitter')

var API = {
  Emitter: ee({}),
  Listener: null,
  NewHash: function(title, content, signature, time) {
    var article = {}
    if (title) article.title = title
    if (content) article.content = content
    if (signature) article.signature = signature
    if (time) article.time = time
    article._id = new Hashes.MD5().hex(JSON.stringify(content))
    return article
  },
  Hash: function(title, content) {
    var hash = new Hashes.MD5().hex(title+JSON.stringify(content))
    return {
      _id: hash,
      title: title,
      content: content
    }
  },
  HashTime: function(title, content, time) {
    var hash = new Hashes.MD5().hex(title+JSON.stringify(content)+JSON.stringify(time))
    return {
      _id: hash,
      title: title,
      content: content,
      time: time
    }
  },
  Get: function(title, cb) {
    var re = new RegExp("^"+title+"$", 'i');
    Waka.db.Articles.findOne({title: re},{},function(match) {
      if (!match) { cb('Not found', null); return;}
      cb(null, match)
    })
  },
  Set: function(title, content, options, cb) {
    Waka.api.Get(title, function(e, match) {
      // ensuring uniqueness of title
      if (match) {
        // maybe add to variants in memory
        Waka.db.Articles.remove(match._id)
      }

      // options to sign a content with a previously generated keyPair
      var signature = null
      if (options.signKeyPair) {
        signature = Waka.crypto.GetSignature({title: title, content: content}, options.signKeyPair.secretKey)
      }

      // option for secure timestamp to verify the date at which a content existed
      if (options.timestampAuthority) {
        // first stamp the hash on the timestamp authority
        Waka.api.Stamp(title, content, options.timestampAuthority, function(timestamp) {
          var article = Waka.api.NewHash(title, content, signature, timestamp)
          Waka.api.Save(article, function(e,r) {
            if (r) cb(null, {match: match, article: article})
          })
        })
      } else {
        var article = Waka.api.NewHash(title, content, signature)
        Waka.api.Save(article, function(e,r) {
          if (r) cb(null, {match: match, article: article})
        })
      }
    })
  },
  Save: function(article, cb) {
    if (!article || !article._id || !article.title || !article.content) {
      cb('invalid article')
      return
    }
    Waka.db.Articles.upsert(article, function(article) {
      // broadcasting our new hash for this article
      Waka.c.broadcast({
        c: 'indexchange',
        data: {_id: article._id, title: article.title}
      })
      cb(null, true);
    })
  },
  Stamp: function(title, content, timestampAuthority, cb) {
    var hash = Waka.api.Hash(title, content)._id;
    var url = "http://steemwhales.com:6060/time/request";
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        var result = JSON.parse(this.responseText)
        result.method = 'STEEM'
        cb(result)
      }
    };
    xhttp.open("POST", url, true);
    xhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xhttp.send("hash="+hash);
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

// Events
// API.Emitter.on('connected', API.Listener = function(){
//   console.log('connected');
// })
// API.Emitter.on('peerchange', API.Listener = function(){
//   console.log('peerchange');
// })
// API.Emitter.on('newshare', API.Listener = function(args){
//   console.log('newshare',args);
// })


var exports = module.exports = API;
