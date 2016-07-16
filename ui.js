var WakaConfig = require('./config.json')
var Ractive = require( 'ractive' )
Ractive.DEBUG = false
require('./wikipedia-api.js')

Waka.Templates = {}
require('./templates/article.js')
require('./templates/network.js')

// search feature
$( "#search" ).submit(function( event ) {
  Waka.GoToArticle(event.target.title.value)
  event.preventDefault();
});

$(window).on('hashchange', function() {
  Waka.CheckUrlHash()
});
