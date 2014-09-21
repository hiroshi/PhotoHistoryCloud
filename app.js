/** @jsx React.DOM */
function binSearch(list, compare, options) {
  var min = 0, max = list.length - 1, found = false, index = 0;
  if (!options) {
    options = {}
  }
  while (max >= min) {
    var mid = Math.floor(min + (max - min) / 2);
    var d = compare(list[mid]);
    if (d == 0) {
      min = mid;
      found = true;
      index = mid;
      break;
    } else if (d < 0) { // item is lager than mid
      min = mid + 1;
      index = mid + 1;
    } else {
      max = mid - 1;
      index = mid;
    }
  }
  if (options.atIndex) {
    options.atIndex(index, found);
  }
  return found;
}

function isiOS() {
    return /(iPad|iPhone|iPod)/g.test( navigator.userAgent );
}

function begginingOfMonth(d) {
  //var n = new Date(d.getTime());
  // var n = new Date(d.getFullYear(), d.getMonth())
  // n.setMonth(n.getMonth() + 1)
  return new Date(d.getFullYear(), d.getMonth());
}

function nextMonth(d) {
  var n = new Date(d.getFullYear(), d.getMonth())
  n.setMonth(n.getMonth() + 1)
  return n;
}

function shortDateTimeString(d) {
  var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return (d.getMonth() + 1) + "/" + d.getDate() + " " + days[d.getDay()] + " " + d.getHours() + ":" + d.getMinutes();
}

function yearMonthString(d) {
  //return d.toISOString().match(/\d+-\d+/)[0];
  return d.getFullYear() + "-" + ('0' + (d.getMonth() + 1)).slice(-2);
}

function getThumbHeight() {
  var thumbMargins = 4;
  var thumb = document.getElementById('thumb-size-sample');
  if (thumb) {
    return thumb.clientHeight + thumbMargins;
  }
  return 0;
}

function getCols() {
  var thumbMargins = 4;
  var thumb = document.getElementById('thumb-size-sample');
  if (thumb) {
    return Math.floor(document.body.offsetWidth / (thumb.clientWidth + thumbMargins));
  }
  return 0;
}

// Google Client SDK helpers
function promiseGAPIExecute(func, options) {
  return Q.Promise(function(resolve, reject, notify) {
    func(options).execute(function(resp) {
      if (resp && resp.error) {
        console.error(resp.error);
        reject(resp.error);
      } else {
        if (resp) {
          notify(resp);
        }
        resolve(resp);
      }
    });
  }).then(function(resp) {
    if (resp && resp.nextPageToken) {
      options.pageToken = resp.nextPageToken;
      return promiseGAPIExecute(func, options);
    } else {
      return resp;
    }
  });
}

/*
  meta must contains 'title' and 'mimeType'.
*/
function promiseUpsertFile(meta, content) {
  var conds = ["title = '" + meta.title + "'", "trashed = false"];
  (meta.parents || []).forEach(function(parent) {
    conds.push("'" + parent.id  + "' in parents")
  });
  var options = {
    q: conds.join(' and '),
    maxResults: 1,
    fields: "items(id)",
  };
  return promiseGAPIExecute(gapi.client.drive.files.list, options)
  .then(function(resp) {
    var path = ['/upload/drive/v2/files'];
    var method = 'POST';
    if (resp && resp.items.length > 0) { // update
      var fileId = resp.items[0].id;
      //console.log("fileId: " + fileId);
      path.push(fileId);
      method = 'PUT';
    }
    if (typeof(content) == 'object') {
      content = JSON.stringify(content)
    }
    return Q.Promise(function(resolve, reject, notify) {
      gapi.client.request({
        path: path.join('/'),
        method: method,
        params: {'uploadType': 'multipart'},
        headers: {
          'Content-Type': 'multipart/mixed; boundary="boundary"'
        },
        body: [
          "",
          "--boundary",
          "Content-Type: application/json",
          "",
          JSON.stringify(meta),
          "",
          "--boundary",
          "Content-Type: " + meta.mimeType,
          "",
          content,
          "--boundary--",
        ].join("\r\n")
      }).execute(function(resp) {
        if (resp && resp.error) {
          console.error(resp.error);
          reject(resp.error);
        } else {
          resolve(resp);
        }
      });
    });
  });
}

function promiseDownloadFile(downloadUrl) {
  return Q.Promise(function(resolve, error, notify) {
    var accessToken = gapi.auth.getToken().access_token;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', downloadUrl);
    xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
    xhr.onload = function() {
      resolve(xhr.responseText);
    };
    xhr.onerror = function(err) {
      error(err);
    };
    xhr.send();
  });
}

var PhotoStore = {
  // items: [], // [{..., _date}]
  files: {}, // {fileId: fileMeta, ...}
  ordered: [], // [fileId, ...] order by date ASC
  yearMonths: [], // [{index, '2009-02'},...]
  callbacks: [],
  registerUpdate: function(callback) {
    this.callbacks.push(callback);
  },
  callbackUpdate: function(updates) {
    this.callbacks.forEach(function(callback) {
      callback(updates);
    });
  },
  updateMonths: function() {
    //var items = this.items;
    var months = [];
    if (this.ordered.length > 0) {
      var first = this.files[this.ordered[0]]._date;
      var last = this.files[this.ordered[this.ordered.length - 1]]._date;
      var prev = begginingOfMonth(first);
      var next = nextMonth(first);
      var total = 0;
      while (prev < last) {
        binSearch(this.ordered, function(itemId) {
          return this.files[itemId]._date - next;
        }.bind(this), {atIndex: function(i, found) {
          var count = i - total;
          if (count > 0) {
            months.push({date: prev, index: i - count, count: count});
          }
          total = i;
        }.bind(this)});
        prev = next;
        next = nextMonth(next);
      }
    }
    this.yearMonths = months;
  },
  loadCache: function() {
    // load cached items from appfolder
    promiseGAPIExecute(gapi.client.drive.files.list, {q: "title = 'items.json' and 'appfolder' in parents"})
    .then(function(resp) {
      if (resp.items && resp.items.length > 0) {
        return resp.items[0];
      } else {
        throw new Error("Not found: items.json");
      }
    }.bind(this))
    .then(function(file) {
      if (file.downloadUrl) {
        return promiseDownloadFile(file.downloadUrl);
      }
    })
    .then(function(responseText) {
      var cache = JSON.parse(responseText);
      // this.ordered = cache.ordered;
      // this.files = cache.files;
      // TODO: refactoring - _date process
      for (var fileId in cache.files) {
        var item = cache.files[fileId];
        var dateString = item.imageMediaMetadata.date;
        if (dateString) {
          var m = dateString.match(/(\d{4}):(\d{2}):(.*)/);
          if (m) {
            dateString = m[1] + "/" + m[2] + "/" + m[3];
          }
        } else {
          dateString = item.modifiedDate;
        }
        item._date = dateString ? new Date(dateString) : new Date();
      }
      // Merge already loaded results of files.list
      this.ordered.forEach(function(fileId) {
        var item = this.files[fileId];
        if (!cache.files[fileId]) {
          binSearch(cache.ordered, function(cacheFileId) {
            return cache.files[cacheFileId]._date - item._date;
          }, {atIndex: function(index) {
            cache.ordered.splice(index, 0, item.id);
          }});
        }
        cache.files[fileId] = item;
      }.bind(this));
      this.ordered = cache.ordered;
      this.files = cache.files;
      this.updateMonths();
      this.callbackUpdate({ordered: this.ordered, months: this.yearMonths});
    }.bind(this))
    .catch(function(err) {
      console.log(err);
    })
    .done(function() {
      console.log("cache (items.json) loaded from appfolder.");
    });
  },
  storeCache: function() {
    // Upload items cache to aappfolder for quick loading on next launches.
    promiseUpsertFile(
      {title: 'items.json', mimeType: 'application/json', parents: [{id: 'appfolder'}]},
      {files: this.files, ordered: this.ordered})
    .done(function(resp) {
        console.log("cache (items.json) stored in appfolder.");
    });
  },
  load: function() {
    var options = {
      q: "mimeType contains 'image/' and trashed = false",
      fields: "items(id,imageMediaMetadata(date,height,width,rotation),thumbnailLink,alternateLink,modifiedDate),nextPageToken",
      maxResults: 1000
    };
    // satrt loading
    this.callbackUpdate({loading: true});
    promiseGAPIExecute(gapi.client.drive.files.list, options)
    .progress(function(resp) {
      if (resp) {
        console.log("progress: " + resp.items.length);
        //var items = this.items;
        resp.items.forEach(function(item) {
          // imageMediaMetadata.date may be in '2014:08:13 17:57:04' format,
          // so convert it to be able to be parsed as Date.
          var dateString = item.imageMediaMetadata.date;
          if (dateString) {
            var m = dateString.match(/(\d{4}):(\d{2}):(.*)/);
            if (m) {
              dateString = m[1] + "/" + m[2] + "/" + m[3];
            }
          } else {
            dateString = item.modifiedDate;
          }
          item._date = dateString ? new Date(dateString) : new Date();
          if (!this.files[item.id]) {
            binSearch(this.ordered, function(fileId) {
              return this.files[fileId]._date - item._date;
            }.bind(this), {atIndex: function(index) {
              this.ordered.splice(index, 0, item.id);
            }.bind(this)});
          }
          this.files[item.id] = item;
          // binSearch(this.items, function(fileId) {
          //   return this.files[fileId]._date - item._date;
          //   //return e._date - item._date;
          // }, {atIndex: function(itemIndex) {
          //   if (items[itemIndex] && items[itemIndex].id == item.id) {
          //     items[itemIndex] = item;
          //   } else {
          //     items.splice(itemIndex, 0, item);
          //   }
          // }.bind(this)});
        }.bind(this));
        //this.items = items;
        this.updateMonths();
        this.callbackUpdate({ordered: this.ordered, months: this.yearMonths});
      }
    }.bind(this))
    .catch(function(err) {
      console.error(err);
    })
    .done(function(resp) {
      this.callbackUpdate({loading: false});
      this.storeCache();
    }.bind(this));
  },
  // getItemsSince: function(date) {
  //   var index = 0;
  //   binSearch(this.items, function(e) {
  //     return e._date - date;
  //   }, {atIndex: function(i) {
  //     index = i;
  //   }});
  //   return this.items.slice(index, index + 50);
  // }
};

var Account = {
  CLIENT_ID: '270744618004-sc56ljkbn8tabp0beq43s09p9p37cnbl.apps.googleusercontent.com',
  SCOPES: [
    'https://www.googleapis.com/auth/drive.readonly',
    //'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.appfolder',
  ].join(" "),
  check: function() {
    gapi.auth.authorize(
      {'client_id': this.CLIENT_ID, 'scope': this.SCOPES, 'immediate': true},
      this._handleAuthResult);
  },
  authorize: function() {
    gapi.auth.authorize(
      {'client_id': this.CLIENT_ID, 'scope': this.SCOPES, 'immediate': false},
      this._handleAuthResult);
  },
  _handleAuthResult: function(authResult) {
    if (authResult && !authResult.error) {
      gapi.client.load('drive', 'v2', function() {
        gapi.client.drive.about.get({fields: "user"}).execute(function(resp) {
          App.setState({email: resp.user.emailAddress})
        });
        console.log("start loading...");
        PhotoStore.loadCache();
        PhotoStore.load();
      });
    } else {
      App.setState({authFailed: true})
    }
  }
};

var NavMonth = React.createClass({
  _handleClick: function() {
    var index = null;
    binSearch(PhotoStore.ordered, function(itemId) {
      return PhotoStore.files[itemId]._date - this.props.date;
    }.bind(this), {atIndex: function(i) {
      index = i;
    }});
    window.scrollTo(0, document.body.offsetHeight * index / PhotoStore.ordered.length);
    this.props.toggle();
    return false;
  },
  render: function() {
    return (
      <li>
        <a href={'#' + yearMonthString(this.props.date)} onClick={this._handleClick}>
          {this.props.title}
        </a>
      </li>
    );
  }
});

var NavMenu = React.createClass({
  render: function() {
    var items = [];
    if (this.props.email) {
      items.push(<li key="email"><a href="#" onClick={this.props.toggle}>{this.props.email}</a></li>);
    }
    items.push(<li key="about"><a href="./about" target="_blank">About</a></li>);
    items.push(<li key="drive"><a href="https://drive.google.com/" target="_blank">Google Drive</a></li>);
    return (
      <ul className="menu">
        { items }
      </ul>
    );
  }
});

var NavMonths = React.createClass({
  render: function() {
    var years = [];
    this.props.months.forEach(function(e) {
      var date = e.date;
      var y = years[years.length - 1];
      if (!y || y.year != date.getFullYear()) {
        years.push({year: date.getFullYear(), months: [date]});
      } else {
        y.months.push(date);
      }
    });
    var items = years.map(function(y) {
      var ms = [];
      var i = 0;
      for (var m = 0; m < 12; m++) {
        var date = y.months[i];
        if (date && date.getMonth() == m) {
          ms.push(<NavMonth key={yearMonthString(date)} date={date} title={date.getMonth() + 1} toggle={this.props.toggle} />);
          i++;
        } else {
          ms.push(<li key={y.year + "-" + (m + 1)} className="hidden">{m + 1}</li>);
        }
      }
      // var ms = y.months.map(function(date) {
      //     return <NavMonth key={yearMonthString(date)} date={date} title={date.getMonth() + 1} toggleNav={this.toggleNav} />;
      // }.bind(this));
      return (
        <li key={y.year}>
          {y.year}/
          <ul className="nav-months">{ms}</ul>
        </li>
      );
    }.bind(this));
    return (
      <ul className="nav-years">
        {items}
      </ul>
    );
  }
});

var Login = React.createClass({
  _handleClick: function() {
    Account.authorize();
  },
  render: function() {
    return <a href="#" onClick={this._handleClick}>Login to access Google Drive</a>;
  }
});

var Navigation = React.createClass({
  getInitialState: function() {
    return {openMonths: false};
  },
  _handleClick: function() {
    this.toggleMonths();
    return false;
  },
  toggleMonths: function() {
    this.setState({openMonths: !this.state.openMonths});
  },
  _handleClickMenu: function() {
    this.toggleMenu();
    return false;
  },
  toggleMenu: function() {
    this.setState({openMenu: !this.state.openMenu});
  },
  render: function() {
    var items = [];
    if (this.props.email) {
      var index = Math.floor(PhotoStore.ordered.length * window.scrollY / document.body.offsetHeight);
      var item = PhotoStore.files[PhotoStore.ordered[index]];
      if (item) {
        var date = item._date;
        var text = date.toLocaleDateString().match(/\d+[\/年]\d+(?:月)?/)[0];
        items.push(<li key="current"><a href='#' onClick={this._handleClick}>{text}</a></li>);
      }
      items.push(<li key="count">{this.props.count} photos</li>);
      if (this.props.loading) {
        items.push(<li key="loading"><img src="loading.gif" /></li>);
      }
    } else if (this.props.authFailed) {
      items.push(<li key="login"><Login /></li>);
    }
    var opens = [];
    if (this.state.openMonths) {
      opens.push(<NavMonths months={this.props.months} toggle={this.toggleMonths} />);
    }
    if (this.state.openMenu) {
      opens.push(<NavMenu email={this.props.email} toggle={this.toggleMenu} />);
    }
    return (
      <div className="navigation">
        <div>
          <ul className="nav-items">
            { items }
          </ul>
          <ul className="nav-items pull-right">
            <li><a href="#" onClick={this._handleClickMenu}>?</a></li>
          </ul>
        </div>
        { opens }
      </div>
    );
  }
});

var Thumbnail = React.createClass({
  _handleError: function(e) {
    //console.error(e.nativeEvent);
    //gapi.client.drive.files.get({fileId: 
  },
  render: function() {
    var meta = this.props.item.imageMediaMetadata;
    var portrait = (Number(meta.width) < Number(meta.height)) ^ (meta.rotation % 2);
    var imgStyle = portrait ? {width: "100%"} : {height: "100%"};
    var date = this.props.item._date;
    var dateLabel = shortDateTimeString(date);
    // <span className="none">{meta}</span>
    return (
      <div className="thumb">
        <a name={yearMonthString(this.props.item._date)} href={this.props.item.alternateLink} target="_blank">
          <img src={this.props.item.thumbnailLink} style={imgStyle} onError={this._handleError} />
          <div className="label">{dateLabel}</div>
        </a>
      </div>
    );
  }
});

var Thumbnails = React.createClass({
  render: function() {
    var total = this.props.ordered.length;
    var cols = getCols();
    var thumbs = [];
    var thumbs_style = {
      'height': Math.ceil(total / cols) * getThumbHeight(),
    };
    var visible_style = {
      'padding-top': this.props.startRow * getThumbHeight(),
    };
    for (var i = 0; i < (this.props.rowCount * cols); i++) {
      var item = PhotoStore.files[this.props.ordered[(this.props.startRow * cols) + i]];
      if (item) {
        thumbs.push(<Thumbnail key={item.id} item={item} />);
      }
    }
    return (
       <div className="thumbs" style={thumbs_style}>
         <div className="visible" style={visible_style}>
           <div className="thumb" id="thumb-size-sample"></div>
           {thumbs}
         </div>
       </div>
    );
  }
});

var PhotoApp = React.createClass({
  getInitialState: function() {
    return {
      ordered: [],
      months: [],
      visibleThumbCount: 50,
      visibleThumbIndex: 0,
      loading: true,
    };
  },
  // FIXME: implement componentDidUnmount
  componentDidMount: function() {
    PhotoStore.registerUpdate(function(updates) {
      this.setState(updates);
    }.bind(this));
    var _updatePosition = function() {
       //var y = window.scrollY;
      //console.log(window.scrollY);
      //var document.getElementsByClassName('thumb')[0]
      var total = this.state.ordered.length;
      var scrollY = window.scrollY;
      var contentH = document.body.offsetHeight;
      var frameH = window.innerHeight;
      var range = 2;
      var cols = getCols();
      var numDisplay = Math.floor(range * total * frameH / contentH);
      numDisplay = Math.floor(numDisplay / cols) * cols;
      var thumbIndex = Math.floor((total * window.scrollY / contentH) - (numDisplay - numDisplay/range) / 2);
      thumbIndex = Math.floor(thumbIndex / cols) * cols;
      thumbIndex = Math.min(Math.max(0, thumbIndex), total - 1);
      //console.log("num: " + numDisplay + " index: " + thumbIndex);
      this.setState({visibleThumbCount: numDisplay, visibleThumbIndex: thumbIndex});
    }.bind(this);
    var timeoutId = null;
    window.addEventListener('scroll', function(e) {
      if (isiOS()) {
        // No need to delay, because onScroll only fire end of scroll on iOS.
        _updatePosition();
      } else {
        if (!timeoutId) {
          timeoutId = setTimeout(function() {
            _updatePosition();
            timeoutId = null;
          }, 300);
        }
      }
    }.bind(this));
  },
  render: function () {
    // var user = null
    // if (this.state.email) {
    //   user = (
    //     <div>
    //       <span>{this.state.email}</span> (<a href="https://accounts.google.com/logout">logout</a>)
    //     </div>
    //   );
    // }
    //var loading = this.state.loading ? "loading..." : "";
    if (!this.state.ordered.length && !this.state.loading) {
        count = (
          <span>
            No image found. Try uploading some via <a href="https://drive.google.com/" target="_blank">Google Drive</a>.
          </span>
        );
    }
    return (
       <div>
         <Navigation
           index={this.state.visibleThumbIndex}
           months={this.state.months}
           count={this.state.ordered.length}
           loading={this.state.loading}
           authFailed={this.state.authFailed}
           email={this.state.email} />
         <Thumbnails
           ordered={this.state.ordered}
           startRow={this.state.visibleThumbIndex / getCols()}
           rowCount={this.state.visibleThumbCount / getCols()} />
       </div>
    );
    //<h1>Photos: {this.state.items.length} {loading}</h1>
  }
});

window.App = React.renderComponent(
  <PhotoApp />,
  document.getElementById('app')
);

/*function handleClientLoad() {
  window.setTimeout(function() {
    Account.check();
  }, 1);
}*/
