var $ = require("jquery")
WikipediaApi = {
  getExtract: function(title, callback) {
    $.ajax({
      url: 'https://en.wikipedia.org/w/api.php',
      jsonp: 'callback',
      dataType: 'jsonp',
      data: {
        action: 'query',
        format: 'json',
        prop: 'pageimages|extracts|links',
        piprop: 'original',
        explaintext: 1,
        exsectionformat: 'wiki',
        redirects: 1,
        titles: title,
        plnamespace: 0,
        pllimit: 500

      },
      xhrFields: { withCredentials: true },
      success: function(response) {
        callback(null, response.query)
      }
    })
  },
  convertWikiToMd: function(wiki) {
    // https://en.wikipedia.org/wiki/Help:Wiki_markup

    // replace titles
    wikiLines = wiki.split('\n')
    for (var i = 0; i < wikiLines.length; i++) {
      var titleType = 0;
      for (var c = 0; c < wikiLines[i].length/2; c++) {
        if (wikiLines[i][c] == '=' && wikiLines[i][wikiLines[i].length-c-1] == '=')
          titleType++;
        else break;
      }
      if (titleType) wikiLines[i] = wikiLines[i].replace(/=/g, '#')
    }
    return wikiLines.join('\n\n');
  },
  addLinks: function(markdown, links, excludes) {
    var mdLowercase = markdown.toLowerCase()
    // sort links by length
    links.sort(function(a,b) {
      return b.title.length - a.title.length;
    })
    for (var i = 0; i < links.length; i++) {
      if (excludes.indexOf(links[i].title) > -1) continue
      var pos = 0
      while (mdLowercase.indexOf(links[i].title.toLowerCase(), pos) > -1) {
        pos = mdLowercase.indexOf(links[i].title.toLowerCase(), pos)
        if (WikipediaApi.canLink(markdown, links[i].title, pos)) {
          markdown = markdown.slice(0,pos) + '[[' + markdown.slice(pos,pos+links[i].title.length) + ']]' + markdown.slice(pos+links[i].title.length)
          mdLowercase = mdLowercase.slice(0,pos) + '[[' + mdLowercase.slice(pos,pos+links[i].title.length) + ']]' + mdLowercase.slice(pos+links[i].title.length)
          pos+=4
        } else pos++
      }
    }
    return markdown
  },
  canLink: function(markdown, title, pos) {
    // disallow linking in the middle of random characters
    var charBefore = markdown[pos-1]
    var charAfter = markdown[pos+title.length]
    var allowFrontierChar = [undefined, ' ', ':', '\n', '\'', '\"', '(', ')', '.', '!', '?']
    if (allowFrontierChar.indexOf(charBefore) == -1 || allowFrontierChar.indexOf(charAfter) == -1)
      return false

    // disallow linking in the middle of a link
    var i = 0;
    while (i < 50) {
      if (markdown.substr(pos+title.length+i, 2) == ']]')
        return false;
      if (markdown.substr(pos-2-i, 2) == '[[')
        return false;
      i++;
    }

    return true
  }
}
