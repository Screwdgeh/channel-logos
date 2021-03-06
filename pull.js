
const fs = require('fs')
const async = require('async')
const needle = require('needle')
const zlib = require('zlib')

const args = process.argv.slice(2)

if (!args[0]) {
  console.error('No TMDB Key set')
  process.exit(1)
}

const tmdbKey = args[0]

let result = {}

try {
  result = JSON.parse(fs.readFileSync('./logo_paths.json', 'utf8'))
} catch(e) {}

const yesterday = new Date((new Date()).valueOf() - 1000*60*60*24)

function addZero(nr) { return ('0' + nr).slice(-2) }

needle.get('https://files.tmdb.org/p/exports/tv_network_ids_'+addZero(yesterday.getMonth())+'_'+addZero(yesterday.getDate())+'_'+yesterday.getFullYear()+'.json.gz?api_key=' + tmdbKey, { compressed: true }, (err, resp, body) => {
  if (!err && body) {
    zlib.gunzip(body, function(err, dezipped) {

      dezipped = Buffer.isBuffer(dezipped) ? dezipped.toString() : dezipped

      const dbExport = JSON.parse("[" + dezipped.split('}\n{').join('},{') + "]")

      console.log('total channels: ' + dbExport.length)

      const delay = 0 // ms

      const queue = async.queue((task, cb) => {
        console.log('fetching logo for ' + task.name)
        console.log(queue.length() + ' / '  + dbExport.length)
        const tag = task.name.toLowerCase()
        if (result[tag]) {
          cb()
          return
        }
        needle.get('https://api.themoviedb.org/3/network/'+task.id+'/images?api_key='+tmdbKey, (error, response, body) => {
          if (task.name) {
            if ((((body || {}).logos || [])[0] || {}).file_path) {
              console.log('success')
              result[tag] = body.logos[0].file_path
            }
          }
          setTimeout(() => { cb() }, delay)
        })
      })

      queue.drain(() => {
        console.log(Object.keys(result).length + ' channel logos saved to ./logo_paths.json')
        fs.writeFileSync('./logo_paths.json', JSON.stringify(result))
      })

      dbExport.forEach(el => { queue.push(el) })

    }, 1)

  } else {
    console.error(err || Error('Could not download daily export from TMDB'))
  }
})
