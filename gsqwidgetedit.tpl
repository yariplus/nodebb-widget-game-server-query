<label>Type</label>
<select class="form-control" name="type">
  {games}
</select>
<br>
<label>Host</label>
<input class="form-control" name="host" placeholder="" type="text">
<br>
<label>Port</label>
<input class="form-control" name="port" placeholder="optional" type="text">
<br>
<label>Query Port</label>
<input class="form-control" name="port_query" placeholder="optional" type="text">
<br>
<label>Template (Use \{data} to print variables.)</label>
<textarea rows="4" class="form-control" name="template" placeholder="Name: \{name}<br>
Address: \{query.host}
Players: \{players.length}/\{maxplayers}"></textarea>
