#!/usr/bin/env node

/**
 * Run as a child process of the main node-webkit app, this process manages the
 * webtorrent client and communicates back to the node-webkit app via websockets
 * courtesy of socket.io.
 *
 * TODO: make ports customizable via commandline parameters.
 */

var WebTorrent = require('webtorrent')
var numeral    = require('numeral')
var address    = require('network-address')
var moment     = require('moment')
var express    = require('express.io')
var peerid     = require('bittorrent-peerid')

var app = express()
app.http().io()
app.listen(9001)

var client = new WebTorrent({ quiet: true })
client.server.listen(9000)

app.io.route('addTorrent', function (req) {
  client.add(req.data.torrentId, req.data.opts)
})

app.io.route('torrent:setStrategy', function (req) {
  var torrent = client.get(req.data.infoHash)
  if (torrent) {
    var oldStrategy = torrent.strategy
    torrent.strategy = req.data.strategy
    app.io.broadcast('log', { message: 'torrent:setStrategy ' + torrent.strategy })
  } else {
    app.io.broadcast('error', { message: 'torrent:setStrategy unable to find torrent ' + req.data.infoHash })
  }
})

client.on('error', function (error) {
  app.io.broadcast('error', { message: error.toString() })
})

client.on('addTorrent', function (torrent) {
  var started = Date.now()
  app.io.broadcast('addTorrent', { infoHash: torrent.infoHash })

  function updateMetadata () {
    app.io.broadcast('torrent:metadata:update', {
      infoHash: torrent.infoHash,
      numPeers: torrent.swarm.numPeers
    })
  }

  torrent.swarm.on('wire', updateMetadata)

  torrent.once('metadata', function () {
    torrent.swarm.removeListener('wire', updateMetadata)

    app.io.broadcast('torrent:update', {
      infoHash: torrent.infoHash,
      name: torrent.name,
      length: bytes(torrent.length),
      lengthRaw: torrent.length,
    })
  })

  torrent.on('verifying', function (data) {
    app.io.broadcast('torrent:verifying:update', {
      infoHash: torrent.infoHash,
      percentDone: data.percentDone,
      percentVerified: data.percentVerified
    })
  })

  torrent.once('ready', function () {
    if (!done) {
      updateId = setInterval(update, 250)
      update()
    }
  })

  torrent.once('done', function () {
    app.io.broadcast('log', { message: 'torrent:done ' + torrent.name + ' (' + torrent.infoHash + ')' })

    done = true
    clearInterval(updateId)
    update(true)
  })

  var href = 'http://' + address() + ':' + client.server.address().port + '/'
  var swarm = torrent.swarm
  var wires = swarm.wires
  var hotswaps = 0
  var updateId
  var done = false

  torrent.on('hotswap', function () {
    hotswaps++
  })

  function active (wire) {
    return !wire.peerChoking
  }

  function bytes (num) {
    return numeral(num).format('0.0b')
  }

  function getRuntime () {
    return Math.floor((Date.now() - started) / 1000)
  }

  function update (done) {
    if (torrent._destroyed) {
      clearInterval(updateId)
      return
    }

    var unchoked = swarm.wires.filter(active)
    var runtime = getRuntime()
    var speed = swarm.downloadSpeed()
    var percentDone = Math.max(0, Math.min(100, 100 * swarm.downloaded / torrent.length))
    var estimatedSecondsRemaining = (done ? 0 : Math.max(0, torrent.length - swarm.downloaded) / (speed > 0 ? speed : -1))
    var estimate = (done ? '' : moment.duration(estimatedSecondsRemaining, 'seconds').humanize())

    var availability = torrent.rarityMap && torrent.rarityMap.pieces
    if (availability) {
      var maxAvailability = availability.reduce(function (max, piece) { return Math.max(max, piece) }, 1)

      availability = availability.map(function (piece) {
        return {
          relative: piece / maxAvailability,
          absolute: piece
        }
      })
    }

    app.io.broadcast('torrent:update', unicodeWorkaround({
      infoHash: torrent.infoHash,
      name: torrent.name,
      runtime: runtime,
      done: !!done,
      streamable: true, // TODO: infer streamable by mimetype
      streamUrl: href,
      mime: client.mime,
      percentDone: percentDone,
      downloadSpeed: bytes(speed) + '/s',
      downloadSpeedRaw: speed,
      numUnchoked: unchoked.length,
      numPeers: wires.length,
      downloaded: bytes(swarm.downloaded),
      downloadedRaw: swarm.downloaded,
      length: bytes(torrent.length),
      lengthRaw: torrent.length,
      uploaded: bytes(swarm.uploaded),
      uploadedRaw: swarm.uploaded,
      eta: estimate,
      etaRaw: estimatedSecondsRemaining,
      peerQueueSize: swarm.numQueued,
      hotswaps: hotswaps,
      pieces: toArray(torrent.storage.bitfield.buffer), // TODO: more compact representation
      availability: availability,
      strategy: torrent.strategy || 'sequential',
      wires: wires.map(function (wire) {
        return {
          pieces: toArray(wire.peerPieces.buffer),
          addr: wire.remoteAddress,
          downloaded: bytes(wire.downloaded),
          downloadedRaw: wire.downloaded,
          downloadSpeed: bytes(wire.downloadSpeed()),
          downloadSpeedRaw: wire.downloadSpeed(),
          choked: wire.peerChoking,
          peerId: wire.peerId.toString('hex'),
          client: peerid(wire.peerId).client
        }
      })
    }))
  }
})

function toArray (buffer) {
  return Array.apply([], buffer)
}

// Workaround for socket.io unicode issue where sending unescapable characters can cause
// webkit to close the connection. This solution ensures that we'll never send an invalid
// utf8 character over the websocket at the expense of possibly introducing malformed
// strings.
// See http://blog.fgribreau.com/2012/05/how-to-fix-could-not-decode-text-frame.html for
// a good breakdown of the problem and possible workarounds.
function unicodeWorkaround (obj) {
  var escapable = /[\x00-\x1f\ud800-\udfff\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufff0-\uffff]/g

  function filterUnicode (quoted) {
    escapable.lastIndex = 0
    if (!escapable.test(quoted)) return quoted

    return quoted.replace(escapable, function () { return '' })
  }

  return JSON.parse(filterUnicode(JSON.stringify(obj)))
}

