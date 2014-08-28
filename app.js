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

function yearMonthString(d) {
  //return d.toISOString().match(/\d+-\d+/)[0];
  return d.getFullYear() + "-" + ('0' + (d.getMonth() + 1)).slice(-2);
}

var PhotoStore = {
  items: [], // [{..., _date}]
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
    var items = this.items;
    var months = [];
    if (items.length > 0) {
      var first = items[0]._date;
      var last = items[items.length - 1]._date;
      var prev = begginingOfMonth(first);
      var next = nextMonth(first);
      var total = 0;
      while (prev < last) {
        binSearch(items, function(e) {
          return e._date - next;
        }, {atIndex: function(i, found) {
          var count = i - total;
          if (count > 0) {
            months.push({date: prev, index: i - count, count: count});
          }
          total = i;
        }});
        prev = next;
        next = nextMonth(next);
      }
    }
    this.yearMonths = months;
  },
  load: function() {
    var options = {
      q: "mimeType contains 'image/' and trashed = false",
      fields: "items(id,imageMediaMetadata(date,height,width,rotation),thumbnailLink,alternateLink),nextPageToken",
      maxResults: 1000
    };
    var _retrieve = function(request) {
      request.execute(function(resp, rawResp) {
        if (resp) {
          var items = this.items;
          resp.items.forEach(function(item) {
            // imageMediaMetadata.date may be in '2014:08:13 17:57:04' format,
            // so convert it to be able to be parsed as Date.
            var dateString = item.imageMediaMetadata.date;
            if (dateString) {
              var m = dateString.match(/(\d{4}):(\d{2}):(.*)/);
              if (m) {
                dateString = m[1] + "/" + m[2] + "/" + m[3];
              }
            }
            item._date = dateString ? new Date(dateString) : new Date();
            binSearch(items, function(e) {
              return e._date - item._date;
            }, {atIndex: function(itemIndex) {
              items.splice(itemIndex, 0, item);
            }.bind(this)});
          }.bind(this));
          this.items = items;
          this.updateMonths();
          this.callbackUpdate({items: items, months: this.yearMonths});
          if (resp.nextPageToken) {
            options.pageToken = resp.nextPageToken;
            _retrieve(gapi.client.drive.files.list(options));
          } else {
            // finish loading
            this.callbackUpdate({loading: false});
          }
        } else {
          // No images found.
          this.callbackUpdate({loading: false});
        }
      }.bind(this));
    }.bind(this);
    // satrt loading
    this.callbackUpdate({loading: true});
    _retrieve(gapi.client.drive.files.list(options));
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

var NavMonth = React.createClass({
  _handleClick: function() {
    var index = null;
    binSearch(PhotoStore.items, function(e) {
      return e._date - this.props.date;
    }.bind(this), {atIndex: function(i) {
      index = i;
    }});
    window.scrollTo(0, document.body.offsetHeight * index / PhotoStore.items.length);
    this.props.toggleNav();
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

var Navigation = React.createClass({
  getInitialState: function() {
    return {open: false};
  },
  _handleClick: function() {
    this.toggleNav();
    return false;
  },
  toggleNav: function() {
    this.setState({open: !this.state.open});
  },
  render: function() {
    var item = PhotoStore.items[this.props.index];
    var current = null;
    if (item) {
      var date = item._date;
      var text = date.toLocaleDateString().match(/\d+[\/年]\d+(?:月)?/)[0];
      current = <a href='#' onClick={this._handleClick}>{text}</a>;
    }
    var months = null;
    if (this.state.open) {
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
            ms.push(<NavMonth key={yearMonthString(date)} date={date} title={date.getMonth() + 1} toggleNav={this.toggleNav} />);
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
      months = (
        <ul className="nav-years">
          {items}
        </ul>
      );
    }
    return (
      <div className="navigation">
        <div>
          {current}
          {months}
        </div>
      </div>
    );
  }
});

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

function isiOS() {
    return /(iPad|iPhone|iPod)/g.test( navigator.userAgent );
}

var PhotoApp = React.createClass({
  getInitialState: function() {
    return {
      items: [],
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
      var total = this.state.items.length;
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
  // _handleScroll: function(event) {
  //   console.log(event.target.scrollTop);
  // },
  // selectDate: function(date) {
  //   this.setState({items: PhotoStore.getItemsSince(date)});
  // },
  render: function () {
    var user = null
    if (this.state.email) {
      user = (
        <div>
          <span>{this.state.email}</span> (<a href="https://accounts.google.com/logout">logout</a>)
        </div>
      );
    }
    // var monthNodes = this.state.months.map(function(m) {
    //   return <MonthLabel month={m} selectDate={this.selectDate} />;
    // }.bind(this));
    var thumbs = [];
    //var thumbs = this.state.items.map(function(item, index) {
    var count = this.state.items.length;
    var cols = getCols();
    var thumbs_style = {
      'height': Math.ceil(count / cols) * getThumbHeight(),
    };
    var visible_style = {
      'padding-top': Math.floor(this.state.visibleThumbIndex / cols) * getThumbHeight(),
    };
    for (var i = 0; i < this.state.visibleThumbCount; i++) {
      //if (this.state.visibleThumbIndex <= index && index < this.state.visibleThumbIndex + this.state.visibleThumbCount) {
        var item = this.state.items[this.state.visibleThumbIndex + i];
      if (item) {
        var meta = item.imageMediaMetadata;
        var portrait = (Number(meta.width) < Number(meta.height)) ^ (meta.rotation % 2);
        var imgStyle = portrait ? {width: "100%"} : {height: "100%"};
        var date = item._date;
        var dateLabel = date.toLocaleDateString().match(/\d+[\/年](\d+[\/月]\d+(?:日)?)/)[1] + " " + date.toLocaleTimeString().match(/\d+:\d+/)[0];
        var img = (
          <div>
            <img src={item.thumbnailLink} style={imgStyle} />
            <div className="label">{dateLabel}</div>
          </div>
        );
        // <span className="none">{meta}</span>
        thumbs.push(
          <div key={item.id} className="thumb">
            <a name={yearMonthString(item._date)} href={item.alternateLink} target="_blank">
              {img}
            </a>
          </div>
        );
      }
    }
    var loading = this.state.loading ? "loading..." : "";
    if (!this.state.items.length && !this.state.loading) {
        count = (
          <span>
            No image found. Try uploading some via <a href="https://drive.google.com/" target="_blank">Google Drive</a>.
          </span>
        );
    }
    return (
       <div>
         <Navigation index={this.state.visibleThumbIndex} months={this.state.months} />
         {user}
         <h1>Photos: {count} {loading}</h1>
         <div className="thumbs" style={thumbs_style}>
           <div className="visible" style={visible_style}>
             <div className="thumb" id="thumb-size-sample"></div>
             {thumbs}
           </div>
          </div>
       </div>
    );
  }
});

window.App = React.renderComponent(
  <PhotoApp />,
  document.getElementById('app')
);
