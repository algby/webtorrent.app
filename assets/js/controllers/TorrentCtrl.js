
angular.module('webtorrent').controller('TorrentCtrl', function (
  $scope, $routeParams, webtorrent)
{
  var torrent = $scope.torrent = $scope.torrentMap[$routeParams.infoHash]
})

