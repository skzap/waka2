var Ractive = require( 'ractive' )

Waka.Templates.Network = new Ractive({
  el: '#network',
  template: '#tNetwork',
  data: {connected: 0},
  refresh: function() {
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
      var articles = []
      Waka.db.Articles.find({},{fields: {_id:1, title: 1}}).fetch(function(res){
        Waka.Templates.Network.set('myarticles', res)
      })
      $( "#networkArticles" ).change(function( event ) {
        Waka.GoToArticle(event.target.value)
      });
    })
  }
})

Waka.Templates.Network.observeOnce('connected', function(r,p){
  if (r) Waka.CheckUrlHash()
})
