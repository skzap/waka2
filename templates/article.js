var Ractive = require( 'ractive' )

Waka.Templates.Article = new Ractive({
  el: '#article',
  template: '#tArticle',
  data: {
    hidden: true,
    shortId: function(longId) {
      if(!longId) return
      return longId.substr(0,4)
    }
  },
  displayAndSearch: function(title, noWiki) {
    Waka.Templates.Article.set('hidden', false)
    var re = new RegExp("^"+title+"$", 'i');
    // search on waka
    Waka.Templates.Article.searchForArticle(title)
    Waka.db.Articles.findOne({title: re}, {}, function(art) {
      if (art) Waka.Templates.Article.refreshArticleTemplate(art)
      else {
        // no match in our local db
        // search on wiki
        if (!noWiki)
          WikipediaApi.getExtract(title, function(err, res) {
            for (var key in res.pages) {
              if (res.pages[key].missing == '') break
              res.pages[key].extract = WikipediaApi.convertWikiToMd(res.pages[key].extract)
              res.pages[key].extract = WikipediaApi.addLinks(res.pages[key].extract, res.pages[key].links, [title])
              res.pages[key].extractHtml = Waka.Syntax(res.pages[key].extract)
              Waka.Templates.Article.set('wiki', res.pages[key])
              if (res.pages[key].title.toLowerCase() != title.toLowerCase()) {
                Waka.Templates.Article.displayAndSearch(res.pages[key].title, true)
              }
            }
          })
      }
    })
  },
  reset: function() {
    Waka.Templates.Article.set('article', null)
    Waka.Templates.Article.set('wiki', null)
    Waka.Templates.Article.set('variants', null)
    Waka.Templates.Article.set('variant', null)
  },
  refreshArticleTemplate: function(article) {
    // converting md to html
    article.contentHtml = Waka.Syntax(article.content)
    Waka.Templates.Article.set('article', article)
    Waka.Templates.Article.RemoveIframes()

    // redirection
    if (article.content.substr(0,2) == '[[' && article.content.substr(article.content.length-2, 2) == ']]')
      Waka.Templates.Article.displayAndSearch(article.content.substr(2,article.content.length-4), true)
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
  createFromWiki: function() {
    var params = window.location.hash.split('#')
    var searchTitle = params[1].replace(/_/g," ")
    var wiki = Waka.Templates.Article.get('wiki')
    if (wiki.title.toLowerCase() != searchTitle.toLowerCase())
      Waka.AddNewRedirect(searchTitle, wiki.title)
    if (wiki.thumbnail && wiki.thumbnail.original)
      Waka.AddNewArticle(wiki.title, wiki.extract, wiki.thumbnail.original, null, function() {
        Waka.Templates.Article.displayAndSearch(wiki.title, true)
      })
    else
      Waka.AddNewArticle(wiki.title, wiki.extract, null, null, function() {
        Waka.Templates.Article.displayAndSearch(wiki.title, true)
      })
  },
  createBlankArticle: function() {
    var params = window.location.hash.split('#')
    var title = params[1]
    Waka.AddNewArticle(title, '', null, null, function() {
      Waka.Templates.Article.displayAndSearch(title, true)
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
    Waka.Templates.Article.checkVariants(function(e,r){
      Waka.Templates.Article.set('variants', r.variants)
    })
  },
  saveArticle: function() {
    var currentArticle = Waka.Templates.Article.get().article
    if (!currentArticle) return
    Waka.AddNewArticle(currentArticle.title, $('#editContent').val(), $('#editImage').val(), null, function() {
      Waka.Templates.Article.displayAndSearch(currentArticle.title, true)
    })
  },
  compareVariant: function(event) {
    if (Waka.Templates.Article.get('variant.isCompare')) {
      Waka.Templates.Article.set('variant.isCompare', false)
      return
    }
    Waka.memory.Variants.findOne({_id: event.context._id}, {}, function(variant){
      variant.contentHtml = Waka.Syntax(variant.content)
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
      variant.contentHtml = Waka.Syntax(variant.content)
      variant.isPreview = true
      Waka.Templates.Article.set('variant', variant)
    })
  },
  adoptVariant: function(event) {
    Waka.memory.Variants.findOne({_id: event.context._id}, {}, function(variant){
      Waka.AddNewArticle(variant.title, variant.content, variant.image, variant._id, function() {
        Waka.Templates.Article.refreshArticleTemplate(variant)
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
    if (params[1] && params[1].indexOf(' ') > -1)  Waka.Templates.Article.GoToArticle(params[1])
    if (params[1]) {
      params[1] = params[1].replace(/_/g," ")
      Waka.Templates.Article.resetDisplaySearch(params[1])
    } else {
      Waka.Templates.Article.GoToArticle(WakaConfig.DefaultArticle)
    }
  },
  resetDisplaySearch: function(title) {
    Waka.Templates.Article.reset()
    Waka.Templates.Article.displayAndSearch(title)
  },
  GoToArticle: function(title) {
    // converting spaces to underscores
    title = title.replace(/ /g,"_")
    window.location.hash = '#' + title
  },
  RemoveIframes: function() {
    var iframes = document.querySelectorAll('iframe');
    for (var i = 0; i < iframes.length; i++) {
        iframes[i].parentNode.removeChild(iframes[i]);
    }
  }
})

Waka.Templates.Article.on({
  createFromWiki: Waka.Templates.Article.createFromWiki,
  editArticle: Waka.Templates.Article.switchEditMode,
  showVariants: Waka.Templates.Article.showVariants,
  saveArticle: Waka.Templates.Article.saveArticle,
  compareVariant: Waka.Templates.Article.compareVariant,
  previewVariant: Waka.Templates.Article.previewVariant,
  adoptVariant: Waka.Templates.Article.adoptVariant,
  downloadVariant: Waka.Templates.Article.downloadVariant,
  createBlankArticle: Waka.Templates.Article.createBlankArticle
})
