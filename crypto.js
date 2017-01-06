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
    return nacl.sign.detached(content, secretKey)
  },
  VerifyContentSignature: function(content, signature, publicKey) {
    content = JSON.stringify(content)
    content = nacl.util.decodeUTF8(content)
    return nacl.sign.detached.verify(content, signature, publicKey)
  }
}

var exports = module.exports = crypto;
