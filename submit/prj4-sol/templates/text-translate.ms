<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Shorten Text</title>
    <link rel="stylesheet" href="style.css">
  </head>
  <body>
    <h1>Shorten Text</h1>
    <form method="POST" action="text-translate.html">
      <p>
      <label for="text">Text</label>
      <textarea id="text" name="text" cols="80" rows="10">
        {{text}}
      </textarea>
      <span class="error">{{error}}</span>
      </p>
      <p><button type="submit">Shorten Text</button></p>
    </label>
    </form>
    <p class="result">{{{result}}}</div>
      {{>footer}}
  </body>
</html>
