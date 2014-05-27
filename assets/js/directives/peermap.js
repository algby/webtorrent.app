
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

        $scope.$watch('peers', function updatePeerMap () {
          map.bubbles($scope.peers, {
            popupTemplate: function (geo, data) {
              var parts = data.addr.split(':')
              return '<div class="hoverinfo"><b>' + parts[0] + '</b>:' + parts[1] + '<br/>' +
                data.name + ' <img src="/assets/img/flags/' + data.country + '.png"/><br/>' +
                'DL: ' + data.downloaded + '<br/>' +
                'DL Speed: ' + data.downloadSpeed + '/s' +
              '</div>'
            }
          })
        })
      }
    }
  }
})

