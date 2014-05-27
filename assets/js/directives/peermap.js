
angular.module('webtorrent').directive('peermap', function (webtorrent) {
  return {
    restrict: 'A',
    link: function postLink ($scope, $element) {
      var initId = null
      var el = document.getElementById($element.attr('id'))

      function tryInit () {
        if (el.offsetWidth > 0 && el.offsetHeight > 0) {
          init()
        } else {
          initId = setTimeout(tryInit, 10)
        }
      }
      tryInit()

      $scope.$on('$destroy', function () {
        clearTimeout(initId)
      })

      // datamaps requires us to only initialize the map once the target element
      // has non-zero size
      function init () {
        var geoip = require('geoip-lite')
        var bubbles = {}

        var map = new Datamap({
          element: el,
          geographyConfig: {
            popupOnHover: false,
            highlightOnHover: true
          },
          fills: {
            defaultFill: '#bbb',//'#ABDDA4',
            bubble: 'rgba(13,215,247,.7)'
          }
        })

        webtorrent.on('torrent:update', updatePeerMap)
        $scope.$on('$destroy', function () {
          webtorrent.removeListener('torrent:update', updatePeerMap)
        })

        function updatePeerMap (t) {
          if (t.infoHash === $scope.torrent.infoHash) {
            var max = t.wires.reduce(function (max, wire) { return Math.max(max, wire.downloadedRaw) }, 0)
            var active = t.wires.map(function (wire) { return wire.addr })

            t.wires.forEach(function (wire) {
              var bubble = bubbles[wire.addr]
              var radius = 50 * (wire.downloadedRaw / max)
              if (radius < 0.0001) return

              if (bubble) {
                bubble.radius = radius
                bubble.downloaded = wire.downloaded
                bubble.downloadSpeed = wire.downloadSpeed
              } else {
                var location = geoip.lookup(wire.addr.split(':')[0])
                var data = {
                  latitude: location.ll[0],
                  longitude: location.ll[1],
                  fillKey: 'bubble',
                  country: location.country.toLowerCase(),
                  radius: radius
                }

                if (location.city && location.region) {
                  data.name = location.city + ' ' + location.region + ', ' + location.country
                } else if (location.city) {
                  data.name = location.city + ', ' + location.country
                } else {
                  data.name = location.country
                }

                bubbles[wire.addr] = _.extend(wire, data)
              }
            })

            bubbles = _.pick(bubbles, active)

            map.bubbles(_.values(bubbles), {
              popupTemplate: function (geo, data) {
                var parts = data.addr.split(':')
                return '<div class="hoverinfo"><b>' + parts[0] + '</b>:' + parts[1] + '<br/>' +
                  data.name + ' <img src="/assets/img/flags/' + data.country + '.png"/><br/>' +
                  'DL: ' + data.downloaded + '<br/>' +
                  'DL Speed: ' + data.downloadSpeed + '/s' +
                '</div>'
              }
            })
          }
        }
      }
    }
  }
})

