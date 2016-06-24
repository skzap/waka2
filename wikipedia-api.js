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
        prop: 'pageimages|extracts',
        piprop: 'original',
        explaintext: 1,
        exsectionformat: 'plain',
        redirects: 1,
        titles: title,

      },
      xhrFields: { withCredentials: true },
      success: function(response) {
        callback(null, response.query)
      }
    })
  }
}
