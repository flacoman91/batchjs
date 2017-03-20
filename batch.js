(function ($) {
  /**
   * Packs the given requests into the batch and returns batch contents.
   * @param {Array} data Data to pack.
   * @param {string} boundary Muti-part boundary mark.
   */
  var pack = function (data, boundary) {
    var body = [];
    var rando = Math.floor((Math.random() * 100000) + 1);
    var changesetboundary = 'changeset_' + rando;
    body.push('--' + boundary);
    body.push('Content-Type: multipart/mixed; boundary=' + changesetboundary, '');

    $.each(data, function (i, d) {
      var t = d.type.toUpperCase(), noBody = ['GET', 'DELETE'], idx;
      body.push('--' + changesetboundary);
      body.push('Content-Type: application/http');
      body.push('Content-Transfer-Encoding: binary', '');

      body.push(t + ' ' + d.url + ' HTTP/1.1');

      /* Don't care about content type for requests that have no body. */
      if (noBody.indexOf(t) < 0) {
        body.push('Content-Type: ' + (d.contentType || 'application/json'));
      }

      // add in custom headers to the batch if there are any
      if (d.hasOwnProperty('headers')) {
        for (idx in d.headers) {
          if (!d.headers.hasOwnProperty(idx)) {
            continue;
          }
          body.push(idx + ': ' + d.headers[idx]);
        }
      }

      body.push('', d.data ? JSON.stringify(d.data) : '');
    });
    body.push('--' + changesetboundary + '--', '');
    body.push('--' + boundary + '--', '');

    return body.join('\r\n');
  };

  /**
   * Unpacks the given response and passes the unpacked data to the original callback.
   * @param {object} xhr jQuery XHR object.
   * @param {string} status Response status.
   * @param {Function} complete A callback to be executed upon unpacking the response.
   */
  var unpack = function (xhr, status, complete) {
    var lines = xhr.responseText.split('\r\n'),
      boundary = lines[0], data = [], d = null;

    $.each(lines, function (i, l) {
      if (l.length) {
        if (l.indexOf(boundary) === 0) {
          if (d) data.push(d);
          d = {};
        } else if (d) {
          if (!d.status) {
            d.status = parseInt((function (m) {
              return m || [0, 0];
            })(/HTTP\/1.1 ([0-9]+)/g.exec(l))[1], 10);
          } else if (!d.data) {
            try {
              d.data = JSON.parse(l);
            } catch (ex) {
            }
          }
        }
      }
    });

    complete.call(this, xhr, status, data);
  };

  $.extend($, {
    ajaxBatch: function (params) {
      var boundary = new Date().getTime().toString();

      $.ajax({
        type: 'POST',
        url: params.url,
        dataType: 'json',
        headers: params.headers,
        data: pack(params.data, boundary),
        contentType: 'multipart/mixed;boundary=' + boundary,
        complete: params.complete ?
          function (xnr, status) {
            unpack(xnr, status, params.complete);
          } :
          null,
        always: params.always ?
          function (xnr, status) {
            unpack(xnr, status, params.always);
          } :
          null
      });
    }
  });
})(jQuery);
