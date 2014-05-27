
angular.module('webtorrent').controller('TorrentCtrl', function (
  $scope, $routeParams, webtorrent)
{
  var torrent = $scope.torrent = $scope.torrentMap[$routeParams.infoHash]
  var geoip = require('geoip-lite')
  var peers = $scope.peers = {}

  // default to list view for peers instead of map view
  $scope.showMap = false

  webtorrent.on('torrent:update', updatePeers)
  $scope.$on('$destroy', function () {
    webtorrent.removeListener('torrent:update', updatePeers)
  })

  function updatePeers (t) {
    if (t.infoHash === torrent.infoHash) {
      var max = t.wires.reduce(function (max, wire) { return Math.max(max, wire.downloadedRaw) }, 0)
      var active = t.wires.map(function (wire) { return wire.addr })

      t.wires.forEach(function (wire) {
        var peer = peers[wire.addr]
        var radius = 50 * (wire.downloadedRaw / max)
        if (radius < 0.0001) return

        if (peer) {
          peer.radius = radius
          peer.downloaded = wire.downloaded
          peer.downloadSpeed = wire.downloadSpeed
        } else {
          var parts = wire.addr.split(':')
          var location = geoip.lookup(parts[0])
          var data = {
            latitude: location.ll[0],
            longitude: location.ll[1],
            fillKey: 'bubble',
            country: location.country.toLowerCase(),
            radius: radius,
            ip: parts[0],
            port: parts[1],
            status: (wire.choked ? 'Choked' : 'Connected')
          }

          if (location.city && location.region) {
            data.name = location.city + ' ' + location.region + ', ' + location.country
          } else if (location.city) {
            data.name = location.city + ', ' + location.country
          } else {
            data.name = location.country
          }

          peers[wire.addr] = _.extend(wire, data)
        }
      })

      peers = _.pick(peers, active)

      $scope.safeApply(function () {
        $scope.peers = _.values(peers)
      })
    }
  }

  $scope.pieChartOptions = {
    barColor: '#0086ca'
  }
})

