
<!DOCTYPE html>
<html>
  <head>
    <title>Add Document</title>
    <link rel="stylesheet" href="{{{base}}}/css/style.css">
  </head>
  <body>
    <h1>Add Document</h1>
    <ul>
    </ul>
    <form action="{{{base}}}/add.html" method="POST" enctype="multipart/form-data">
      <label>
        <span class="label">Choose file:</span>
        <input id="file" name="file" type="file">
      </label>
      <br/>
      {{#errors}}
	      <span class="error">{{.}}}</span><br/>
	    {{/errors}}
      <input id="submit" name="submit" type="submit"
             value="add" class="control">
    </form>

{{>footer}}
  </body>
</html>
