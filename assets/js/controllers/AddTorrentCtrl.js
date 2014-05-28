
angular.module('webtorrent').controller('AddTorrentCtrl', function (
  $scope, $modalInstance)
{
  //JH2TF3UY4IIOMTJ7SCNAZIBZ3IFSX45H

  $scope.torrent = {
    id: null,
    filename: null
  }

  $scope.ok = function () {
    var id = $scope.torrent.id || $scope.torrent.filename

    if (id) {
      $modalInstance.close(id)
    }
  }

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel')
  }

  $scope.torrentFileChanged = function (el) {
    var filename = $(el).val()
    if (filename.indexOf(".torrent") !== -1) {
      $scope.safeApply(function () {
        $scope.torrent.filename = filename
      })
    } else {
      // clear invalid input file by resetting form
      $('#fileReset').trigger('click')
    }
  }
})

