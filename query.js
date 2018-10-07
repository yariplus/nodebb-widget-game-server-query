// nodebb-plugin-game-server-query
// query.js

const { query } = require('gamedig')
const async = require.main.require('async')

process.on('message', data => {
  let object = {}

  // Reduce query responses to a db object and send it back to the parent.
  async.reduce(data, {}, (obj, widget, next) => {
    let { type, host, port, port_query } = widget
    let options = { type, host }

    // Optional port inputs.
    if (port) options.port = port
    if (port_query) options.port_query = port_query

    // The field stored in the database object.
    const field = `${type}${host.replace(/[.:]/g, '')}${port||''}${port_query||''}`

    // Don't double query if the field exists.
    if (obj[field]) return next(null, obj)

    query(options, (err, state) => {
      if (!err) obj[field] = JSON.stringify(state)

      next(null, obj)
    })
  }, (err, states) => process.send(states))
})
