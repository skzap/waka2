var Hashes = require('jshashes')
var ee = require('event-emitter')

var API = {
  Emitter: ee({}),
  Listener: null,
  NewHash: function(article, signature, time) {
    if (signature) article.signature = signature
    if (time) article.time = time
    article._id = new Hashes.MD5().hex(JSON.stringify(article))
    return article
  },
  // Hash: function(title, content) {
  //   var hash = new Hashes.MD5().hex(title+JSON.stringify(content))
  //   return {
  //     _id: hash,
  //     title: title,
  //     content: content
  //   }
  // },
  // HashTime: function(title, content, time) {
  //   var hash = new Hashes.MD5().hex(title+JSON.stringify(content)+JSON.stringify(time))
  //   return {
  //     _id: hash,
  //     title: title,
  //     content: content,
  //     time: time
  //   }
  // },
  Get: function(title, cb) {
    Waka.db.Articles.findOne({'info.title': title},{},function(match) {
      if (!match) { cb('Not found', null); return;}
      cb(null, match)
    })
  },
  Set: function(article, options, cb) {
    Waka.api.Get(article.info.title, function(e, match) {
      // ensuring uniqueness of title
      if (match) {
        // maybe add to variants in memory
        Waka.db.Articles.remove(match._id)
      }

      // options to sign a content with a previously generated keyPair
      var signature = null
      if (options.signKeyPair) {
        signature = {
          pubKey: options.signKeyPair.publicKeyBase64,
          base64: Waka.crypto.GetSignature(article, options.signKeyPair.secretKey)
        }
      }

      // option for secure timestamp to verify the date at which a content existed
      if (options.timestampAuthority) {
        // first stamp the hash on the timestamp authority
        Waka.api.Stamp(article, signature, options.timestampAuthority, function(timestamp) {
          var article = Waka.api.NewHash(article, signature, timestamp)
          Waka.api.Save(article, function(e,r) {
            if (r) cb(null, {match: match, article: article})
          })
        })
      } else {
        var validArticle = Waka.api.NewHash(article, signature)
        Waka.api.Save(validArticle, function(e,r) {
          if (r) cb(null, {match: match, article: article})
        })
      }
    })
  },
  Save: function(article, cb) {
    if (!article || !article._id || !article.info || !article.info.title || !article.content) {
      cb('invalid article')
      return
    }
    Waka.db.Articles.upsert(article, function(article) {
      // broadcasting our new hash for this article
      Waka.c.broadcast({
        c: 'indexchange',
        data: {_id: article._id, info: article.info}
      })
      cb(null, true);
    })
  },
  Stamp: function(article, signature, timestampAuthority, cb) {
    var hash = Waka.api.NewHash(article, signature)._id;
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
  Search: function(title) {
    console.log('Searching',title)

    // deletes all previous searches for this user? why ??
    Waka.mem.Search.find({origin: Waka.c.id},{}).fetch(function(s) {
      for (var i = 0; i < s.length; i++) {
        Waka.mem.Search.remove(s[i]._id)
      }
    })

    var search = {
      info: {title: title},
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
    Waka.db.Articles.find({},{fields: {_id:1, info: 1}}).fetch(function(res){
      cb(null, res)
    })
  },
  DeleteFieldsWithDots: function(object) {
    for (var key in object) {
      if (key.indexOf('.') > -1) {
        delete object[key]
        continue
      }
      if (typeof object[key] === 'object') {
        object[key] = this.DeleteFieldsWithDots(object[key])
      }
    }
    return object
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
