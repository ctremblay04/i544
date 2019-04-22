<!DOCTYPE html>
<html lang="en">
  <head>
    <title>URL Deactivate</title>
    <link rel="stylesheet" href="style.css">
  </head>
  <body>
    <h1>URL Deactivate</h1>
     <span class="error">{{error}}</span>
    <form method="POST" action="url-deactivate.html">
      <p>
        <label for="url">URL</label>
        <input type="url" id="url" name="url" value="{{url}}">
        <span class="error"></span>
      </p>
      <p><button type="submit">Deactivate URL</button></p>
    </form>
    <p class="result">{{result}}</div>
  {{>footer}}
  </body>
</html>

