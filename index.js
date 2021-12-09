// nodebb-widget-game-server-query
// index.js

const { promises: fs } = require('fs')
const path = require('path')
const { fork } = require('child_process')

const benchpress = require.main.require('benchpressjs')
const db = require.main.require('./src/database')
const widgetAdmin = require.main.require('./src/widgets/admin')

let app, interval, child, games

exports.load = async nodebb => {
  // Get app for rendering.
  app = nodebb.app

  // Find the gamedig path and read its game db.
  const filename = path.normalize(path.join(path.dirname(require.resolve('gamedig')), '..' , 'games.txt'))
  const file = await fs.readFile(filename, 'utf8')

  // Parse the file into games html for the widget admin panel.
  // TODO: Could be a template.
  games = file.split('\n').reduce((games, line) => {
    const comment = line.indexOf('#')
    if (comment !== -1) line = line.substr(0, comment)

    line = line.trim()
    if (!line) return games

    line = line.split('|')
    if (!line.length > 1) return games

    const protocol = line[2]
    const name = line[1]
    const id = line[0].split(',')[0]

    return `${games}<option value="${id}">${name} (${protocol})</option>`
  }, '')

  // Clear any previous query interval.
  if (interval) clearInterval(interval)

  // Start child process.
  if (!child) child = fork(`${__dirname}/query.js`)

  // Get status messages from child.
  child.on('message', data => db.setObject('gsq', data))

  // Query all hosts every 15 seconds.
  // TODO: Configurable timeout per widget.
  interval = setInterval(async () => {
    let areas, widgets, servers = [], keys = []

    // Get all widgets.
    areas = await widgetAdmin.getAreas()
    areas = areas.filter(area => area.name !== 'Draft Zone')

    // Filter to gsq widgets.
    widgets = areas.reduce((widgets, area) => widgets.concat(
      area.data.filter(widget => widget.widget === 'gsq')
        .filter(widget => widget.data.type && widget.data.host)
        .map(widget => {
          const { type, host, port, port_query } = widget.data

          let server = { type, host }

          // Optional port inputs.
          if (port) server.port = port
          if (port_query) server.port_query = port_query

          server.key = `${type}${host.replace(/[.:]/g, '')}${port||''}${port_query||''}`

          return server
        })
    ), [])

    // Ignore widgets with the same server settings.
    widgets.forEach(widget => {
      if (keys.indexOf(widget.key) === -1) {
        keys = keys.concat(widget.key)
        servers = servers.concat(widget)
      }
    })

    if (servers) child.send(servers)
  }, 15000)
}

exports.getWidgets = async widgets => {
  try {
    widgets.push({
      widget: 'gsq',
      name: 'Game Server Query',
      description: 'Queries a game server.',
      content: await app.renderAsync('gsqwidgetedit', {games}),
    })
  } catch (err) {
    console.log('Error parsing nodebb-widget-game-server-query admin widgets.')
    console.log(err)
  } finally {
    return widgets
  }
}

exports.renderWidget = (widget) => new Promise(async (accept, reject) => {
  let { type, host, port, port_query, template } = widget.data

  if (!type || !host) return next(new Error('No host information for GSQ widget.'))

  host = host.replace(/[.:]/g, '')

  const field = `${type}${host}${port||''}${port_query||''}`

  // Each field is the stringified last query result.
  let state = await db.getObjectField('gsq', field)
  let html

  if (!state) {
    // TODO
    widget.html = ''
    console.log(`No status for field: "${field}"`)
    accept(widget)
  }

  // Parse the query state string and restringify in pretty print.
  state = JSON.parse(state)
  state.data = '<pre>' + JSON.stringify(state, null, 4) + '</pre>'

  if (template) {
    html = await benchpress.compileRender(template, state)
  } else {
    html = await app.renderAsync('gsqwidget', state)
  }

  widget.html = html

  accept(widget)
})

