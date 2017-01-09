var FileSaver = require('file-saver');
var nacl = require('tweetnacl')
nacl.util = require('tweetnacl-util');

var crypto = {
  GenKeyPair: function(save) {
    var keyPair = nacl.sign.keyPair()
    keyPair.publicKeyBase64 = nacl.util.encodeBase64(keyPair.publicKey)
    keyPair.secretKeyBase64 = nacl.util.encodeBase64(keyPair.secretKey)
    if (save)
      Waka.db.Keys.upsert(keyPair, function(keyPair) {})
    return keyPair
  },
  GenKeyPairStartsWith: function(start) {
    var keyPair = null
    while (!keyPair || !keyPair.publicKeyBase64.startsWith(start)) {
      keyPair = Waka.crypto.GenKeyPair()
    }
    Waka.db.Keys.upsert(keyPair, function(keyPair) {})
    return keyPair
  },
  GetSignature: function(content, secretKey) {
    content = JSON.stringify(content)
    content = nacl.util.decodeUTF8(content)
    var signature = nacl.sign.detached(content, secretKey)
    var signatureBase64 = nacl.util.encodeBase64(signature)
    return signatureBase64
  },
  VerifyContentSignature: function(content, signature, publicKey) {
    content = JSON.stringify(content)
    content = nacl.util.decodeUTF8(content)
    return nacl.sign.detached.verify(content, signature, publicKey)
  },
  ExportKeys: function() {
    Waka.db.Keys.find({},{}).fetch(function(keys) {
      var json = JSON.stringify(keys)
      var blob = new Blob([json], {type: "text/plain;charset=utf-8"})
      FileSaver.saveAs(blob, "keys.txt")
    })
  },
  ImportKeys: function(json) {
    var keys = JSON.parse(json)
    for (var i = 0; i < keys.length; i++) {
      Waka.db.Keys.upsert(keys[i], function(keyPair) {})
    }
  }
}

var exports = module.exports = crypto;
