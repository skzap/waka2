var concat = require('concat-files');

concat([
  './templates/header.html',
  './templates/article.html',
  './templates/network.html',
  './templates/footer.html'
], './output/index.html', function() {
  console.log('done');
});
