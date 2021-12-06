// nodebb-plugin-game-server-query
// query.js

const { query } = require('gamedig')

process.on('message', async (servers) => {
  // Query servers async.
  let results = await Promise.all(servers.map(async (server) => {
    let result

    try {
      result = await query(server)
    } catch (err) {
      result = err
    }

    result.key = server.key

    return result
  }, []))

  // Reduce results to a db object.
  results = results.reduce((results, result) => {
    results[result.key] = JSON.stringify(result)

    return results
  }, {})

  // Send results back for storage in the db.
  process.send(results)
})

