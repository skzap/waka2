var WakaConfig = require('./config.json')
var Ractive = require( 'ractive' )
Ractive.DEBUG = false
var marked = require('marked')
require('./wikipedia-api.js')

Waka.Templates = {
  Network: new Ractive({
    el: '#network',
    template: '#tNetwork',
    data: {connected: 0}
  }),
  Article: new Ractive({
    el: '#article',
    template: '#tArticle',
    data: {
      hidden: true,
      shortId: function(longId) {
        if(!longId) return
        return longId.substr(0,4)
      }
    }
  })
}

Waka.Templates.Network.observeOnce('connected', function(r,p){
  if (r) Waka.UI.checkUrlHash()
})

Waka.UI = {
  displayAndSearch: function(title, noWiki) {
    Waka.Templates.Article.set('hidden', false)
    var re = new RegExp("^"+title+"$", 'i');
    // search on waka
    Waka.UI.searchForArticle(title)
    Waka.db.Articles.findOne({title: re}, {}, function(art) {
      if (art) Waka.UI.refreshArticleTemplate(art)
      else {
        // no match in our local db
        // search on wiki
        if (!noWiki)
          WikipediaApi.getExtract(title, function(err, res) {
            for (var key in res.pages) {
              if (res.pages[key].missing == '') break
              res.pages[key].extract = WikipediaApi.convertWikiToMd(res.pages[key].extract)
              res.pages[key].extract = WikipediaApi.addLinks(res.pages[key].extract, res.pages[key].links, [title])
              res.pages[key].extractHtml = Waka.UI.WakaSyntax(res.pages[key].extract)
              Waka.Templates.Article.set('wiki', res.pages[key])
              if (res.pages[key].title.toLowerCase() != title.toLowerCase()) {
                Waka.UI.displayAndSearch(res.pages[key].title, true)
              }
            }
          })
      }
    })
  },
  resetArticleTemplate: function() {
    Waka.Templates.Article.set('article', null)
    Waka.Templates.Article.set('wiki', null)
    Waka.Templates.Article.set('variants', null)
    Waka.Templates.Article.set('variant', null)
  },
  refreshArticleTemplate: function(article) {
    // converting md to html
    article.contentHtml = Waka.UI.WakaSyntax(article.content)
    Waka.Templates.Article.set('article', article)

    // redirection
    if (article.content.substr(0,2) == '[[' && article.content.substr(article.content.length-2, 2) == ']]')
      Waka.UI.displayAndSearch(article.content.substr(2,article.content.length-4), true)
  },
  searchForArticle: function(title) {
    console.log('Searching for',title)
    Waka.memory.Search.find({origin: Waka.c.id},{}).fetch(function(s) {
      for (var i = 0; i < s.length; i++) {
        Waka.memory.Search.remove(s[i]._id)
      }
    })
    Waka.memory.Search.upsert({title: title, origin: Waka.c.id})
    Waka.c.broadcast({
      c:'search',
      data: {title: title, origin: Waka.c.id, echo: 2}
    })
  },
  addNewArticle: function(title, content, image, compareHash, cb) {
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
        cb()
      })
    })
  },
  addNewRedirect: function(titleFrom, titleTo) {
    Waka.UI.addNewArticle(titleFrom, '[['+titleTo+']]', null, null, function(){
    })
  },
  createFromWiki: function() {
    var params = window.location.hash.split('#')
    var searchTitle = params[1]
    var wiki = Waka.Templates.Article.get('wiki')
    if (wiki.title.toLowerCase() != searchTitle.toLowerCase())
      Waka.UI.addNewRedirect(searchTitle, wiki.title)
    if (wiki.thumbnail && wiki.thumbnail.original)
      Waka.UI.addNewArticle(wiki.title, wiki.extract, wiki.thumbnail.original, null, function() {
        Waka.UI.displayAndSearch(wiki.title, true)
      })
    else
      Waka.UI.addNewArticle(wiki.title, wiki.extract, null, null, function() {
        Waka.UI.displayAndSearch(wiki.title, true)
      })
  },
  createBlankArticle: function() {
    var params = window.location.hash.split('#')
    var title = params[1]
    Waka.UI.addNewArticle(title, '', null, null, function() {
      Waka.UI.displayAndSearch(title, true)
    })
  },
  switchEditMode: function() {
    Waka.Templates.Article.set('edit', !Waka.Templates.Article.get('edit'))
  },
  checkVariants: function(cb) {
    var article = Waka.Templates.Article.get('article')
    var title = article.title
    if (!title) return
    Waka.memory.Peers.find({'index.title': title},{}).fetch(function(peers){
      if (!peers) cb('No peers indexed this article')
      var result = {
        title: title,
        peers: peers.length,
        variants: []
      }
      for (var i = 0; i < peers.length; i++) {
        for (var y = 0; y < peers[i].index.length; y++) {
          if (peers[i].index[y].title == title) {
            var exists = false
            for (var v = 0; v < result.variants.length; v++) {
              if (peers[i].index[y]._id == result.variants._id) {
                exists = true
                result.variants[v].count++
              }
            }
            if (!exists) {
              Waka.memory.Variants.findOne({_id: peers[i].index[y]._id},{},function(match){
                var variant = {
                  _id: peers[i].index[y]._id,
                  count: 1
                }
                if (match) variant.downloaded = true
                if (variant._id == Waka.Templates.Article.get('article._id')) variant.current = true
                result.variants.push(variant)
              })
            }
          }
        }
      }
      cb(null, result)
    })
  },
  showVariants: function() {
    Waka.UI.checkVariants(function(e,r){
      Waka.Templates.Article.set('variants', r.variants)
    })
  },
  saveArticle: function() {
    var currentArticle = Waka.Templates.Article.get().article
    if (!currentArticle) return
    Waka.UI.addNewArticle(currentArticle.title, $('#editContent').val(), $('#editImage').val(), null, function() {
      Waka.UI.displayAndSearch(currentArticle.title, true)
    })
  },
  compareVariant: function(event) {
    if (Waka.Templates.Article.get('variant.isCompare')) {
      Waka.Templates.Article.set('variant.isCompare', false)
      return
    }
    Waka.memory.Variants.findOne({_id: event.context._id}, {}, function(variant){
      variant.contentHtml = Waka.UI.WakaSyntax(variant.content)
      var dmp = new diff_match_patch();
      var d = dmp.diff_main(Waka.Templates.Article.get('article.content'), variant.content);
      dmp.diff_cleanupSemantic(d);
      variant.diffString = dmp.diff_prettyHtml(d);
      if (Waka.Templates.Article.get('article.image') != variant.image)
        variant.imageChange = {
          old: Waka.Templates.Article.get('article.image')
        }
      variant.isCompare = true
      Waka.Templates.Article.set('variant', variant)
    })
  },
  previewVariant: function(event) {
    if (Waka.Templates.Article.get('variant.isPreview')) {
      Waka.Templates.Article.set('variant.isPreview', false)
      return
    }
    Waka.memory.Variants.findOne({_id: event.context._id}, {}, function(variant){
      variant.contentHtml = Waka.UI.WakaSyntax(variant.content)
      variant.isPreview = true
      Waka.Templates.Article.set('variant', variant)
    })
  },
  adoptVariant: function(event) {
    Waka.memory.Variants.findOne({_id: event.context._id}, {}, function(variant){
      Waka.UI.addNewArticle(variant.title, variant.content, variant.image, variant._id, function() {
        Waka.UI.refreshArticleTemplate(variant)
      })
    })
  },
  downloadVariant: function(event) {
    Waka.memory.Search.upsert({variant: event.context._id, origin:Waka.c.id})
    Waka.memory.Peers.find({'index._id': event.context._id},{}).fetch(function(peers){
      for (var i = 0; i < peers.length; i++) {
        Waka.c.messageToPeer(peers[i]._id, {c:'download', data: {_id:event.context._id, origin: Waka.c.id}})
      }
    })
  },
  checkUrlHash: function() {
    params = window.location.hash.split('#')
    if (params[1]) {
      Waka.UI.resetDisplaySearch(params[1])
    } else {
      window.location.hash = '#' + WakaConfig.DefaultArticle
    }
  },
  resetDisplaySearch: function(title) {
    Waka.UI.resetArticleTemplate()
    Waka.UI.displayAndSearch(title)
  },
  WakaSyntax: function(content) {
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
  },
  RefreshNetwork: function() {
    Waka.memory.Peers.find({},{}).fetch(function(res){
      Waka.Templates.Network.set('connected', res.length)
      var articles = []
      for (var i = 0; i < res.length; i++) {
        if (!res[i].index) continue
        for (var y = 0; y < res[i].index.length; y++) {
          if (articles.indexOf(res[i].index[y].title) == -1)
            articles.push(res[i].index[y].title)
        }
      }
      Waka.Templates.Network.set('articles', articles)
      $( "#networkArticles" ).change(function( event ) {
        Waka.UI.NetworkArticle(event.target.value)
      });
    })
  },
  NetworkArticle: function(article) {
    window.location.hash = '#' + article
  }
}

// search feature
$( "#search" ).submit(function( event ) {
  window.location.hash = '#' + event.target.title.value
  event.preventDefault();
});

// article features
Waka.Templates.Article.on({
  createFromWiki: Waka.UI.createFromWiki,
  editArticle: Waka.UI.switchEditMode,
  showVariants: Waka.UI.showVariants,
  saveArticle: Waka.UI.saveArticle,
  compareVariant: Waka.UI.compareVariant,
  previewVariant: Waka.UI.previewVariant,
  adoptVariant: Waka.UI.adoptVariant,
  downloadVariant: Waka.UI.downloadVariant,
  createBlankArticle: Waka.UI.createBlankArticle
})

$(window).on('hashchange', function() {
  Waka.UI.checkUrlHash()
});
