<!DOCTYPE html>
<html lang="en">
  <head>
    <title>URL Info</title>
    <link rel="stylesheet" href="style.css">
  </head>
  <body>
    <h1>URL Info</h1>
    <span class="error"></span>
    <form method="GET" action="url-info.html">
      <input type="hidden" name="isSubmit" value="true">
      <p>
        <label for="url">URL</label>
        <input type="url" id="url" name="url" value="{{url}}">
        <span class="error">{{error}}</span>
      </p>
      <p><button class="submit" type="submit">Get URL Info</button></p>
    </form>
      {{#result}}
       <dl class="result">
         <dt>Short Url</dt><dd class="url">{{result.shortUrl}}</dd>
         <dt>Long Url</dt><dd class="url">{{result.longUrl}}</dd>
         <dt>Count</dt><dd>{{result.count}}</dd>
         <dt>Active Status</dt><dd>{{result.isActive}}</dd>
       </dl>
      {{/result}}
      {{>footer}}
  </body>
</html>
