// nodebb-plugin-game-server-query
// query.js

const { query } = require('gamedig')
const async = require.main.require('async')

process.on('message', (data) => {
  let object = {}

  data = JSON.parse(data)

  async.reduce(data, {}, (obj, widget, next) => {
    let { type, host } = widget

    query({type, host}, (err, state) => {
      if (err) return next(null, obj)

      host = host.replace(/[.:]/g, '')

      if (obj[`${type}${host}`]) return next(null, obj)

      obj[`${type}${host}`] = JSON.stringify(state)

      next(null, obj)
    })
  }, (err, states) => {
    process.send(JSON.stringify(states))
    process.disconnect()
  })
})
