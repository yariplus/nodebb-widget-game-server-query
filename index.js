// nodebb-widget-game-server-query
// index.js

const fs = require('fs')
const path = require('path')
const { fork } = require('child_process')
const benchpress = require.main.require('benchpressjs')
const db = require.main.require('./src/database')
const widgetAdmin = require.main.require('./src/widgets/admin')

let app, interval, child, games = []

exports.load = (data, next) => {
  app = data.app

  fs.readFile(path.normalize(__dirname + '/node_modules/gamedig/games.txt'), 'utf8', (err, data) => {
    if (err) {
      console.log(err)
    }

    data = data.split('\n')

    games = data.reduce((games, line) => {
      const comment = line.indexOf('#')
      if (comment !== -1) line = line.substr(0, comment)

      line = line.trim()
      if (!line) return games

      line = line.split('|')
      if (!line.length > 1) return games

      const game = line[0]
      const name = line[1]

      return `${games}<option value="${game}">${name}</option>`
    }, '')
  })

  // Clear any previous query interval.
  if (interval) clearInterval(interval)

  // Start child process.
  if (!child) child = fork(`${__dirname}/query.js`)

  // Get status messages from child.
  child.on('message', data => db.setObject('gsq', JSON.parse(data)))

  // Query all hosts every 15 seconds.
  interval = setInterval(() => {

    // Get all widgets.
    widgetAdmin.get((err, data) => {
      if (err) return console.log(err)

      // Filter gsq widgets.
      // TODO: Need to make this less messy.
      data = data.areas.reduce((widgets, area) => {
        return widgets.concat(area.data.filter(widget => widget.widget === 'gsq').filter(widget => widget.data.type && widget.data.host).map(widget => {
          const { type, host, port, port_query } = widget.data

          return { type, host, port, port_query }
        }))
      }, [])

      data = JSON.stringify(data)

      child.send(data)
    })
  }, 15000)

  next()
}

exports.getWidgets = (widgets, next) => {
  app.render('gsqwidgetedit', {games}, (err, content) => {
    if (err) {
      console.log(err)
      return next(null, widgets)
    }

    widgets.push({
      widget: 'gsq',
      name: 'Game Server Query',
      description: 'Queries a game server.',
      content
    })

    next(null, widgets)
  })
}

exports.renderWidget = (widget, next) => {
  let { type, host, port, port_query, template } = widget.data

  if (!type || !host) return next(new Error('No host information for GSQ widget.'))

  host = host.replace(/[.:]/g, '')

  const key = `${type}${host}${port||''}${port_query||''}`

  db.getObjectField('gsq', key, (err, state) => {
    if (err || !state) {
      // TODO
      widget.html = ''
      console.log(`No template ${key}`)
      return next(null, widget)
    }

    state = JSON.parse(state)
    state.data = '<pre>' + JSON.stringify(state, null, 4) + '</pre>'

    if (template) {
      benchpress.compileParse(template, state, (err, html) => {
        widget.html = html
        next(err, widget)
      })
    } else {
      app.render('gsqwidget', state, (err, html) => {
        widget.html = html
        next(err, widget)
      })
    }
  })
}
