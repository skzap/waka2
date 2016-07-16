var marked = require('marked')

Waka.HashArticle = function(article) {
  var hash = new Hashes.MD5().hex(article.title)
  hash += new Hashes.MD5().hex(article.content)
  hash += new Hashes.MD5().hex(article.image)
  article._id = new Hashes.MD5().hex(hash)
  return article
}
Waka.AddNewArticle = function(title, content, image, compareHash, cb) {
  var article = Waka.HashArticle({
    title: title,
    content: content,
    image: image
  })
  if (compareHash && article._id != compareHash) return
  var re = new RegExp("^"+title+"$", 'i');
  Waka.db.Articles.findOne({title: re},{},function(match) {
    // ensuring uniqueness of title
    if (match) {
      Waka.db.Articles.remove(match._id)
    }
    Waka.db.Articles.upsert(article, function() {
      Waka.Templates.Network.refresh()
      cb()
    })
  })
  // broadcasting our new hash for this article
  Waka.c.broadcast({
    c: 'indexchange',
    data: {_id: article._id, title: article.title}
  })
}
Waka.AddNewRedirect = function(titleFrom, titleTo) {
  Waka.AddNewArticle(titleFrom, '[['+titleTo+']]', null, null, function(){
  })
}
Waka.Syntax = function(content) {
  //var contentHtml = marked(content)
  var contentCopy = content
  // extra syntax
  // [[ ]] Double matching brackets wiki style
  var words = []
  var wordsMarkdown = []
  while (contentCopy.indexOf('[[') > -1 && contentCopy.indexOf(']]') > -1) {
    words.push(contentCopy.substring(contentCopy.indexOf('[['), contentCopy.indexOf(']]')+2))
    contentCopy = contentCopy.substr(contentCopy.indexOf(']]')+2)
  }
  for (var i = 0; i < words.length; i++) {
    if (words[i].indexOf('|') > -1) {
      var link = words[i].substring(2, words[i].indexOf('|'))
      var display = words[i].substring(words[i].indexOf('|')+1, words[i].length-2)
      wordsMarkdown.push('['+display+'](#'+link+')')
    }
    else
      wordsMarkdown.push('['+words[i].substring(2, words[i].length-2)+'](#'+words[i].substring(2, words[i].length-2)+')')
    content = content.replace(words[i], wordsMarkdown[i])
  }
  return marked(content)
}
Waka.CheckUrlHash = function() {
  params = window.location.hash.split('#')
  if (params[1] && params[1].indexOf(' ') > -1)  Waka.GoToArticle(params[1])
  if (params[1]) {
    params[1] = params[1].replace(/_/g," ")
    Waka.Templates.Article.resetDisplaySearch(params[1])
  } else {
    Waka.GoToArticle(WakaConfig.DefaultArticle)
  }
}
Waka.GoToArticle = function(title) {
  // converting spaces to underscores
  title = title.replace(/ /g,"_")
  window.location.hash = '#' + title
}
