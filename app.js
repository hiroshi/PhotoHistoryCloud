/** @jsx React.DOM */
function binSearch(list, compare, options) {
  var min = 0, max = list.length - 1;
  if (!options) {
    options = {}
  }
  while (max >= min) {
    var mid = Math.floor(min + (max - min) / 2);
    var d = compare(list[mid]);
    if (d == 0) {
      min = mid;
      break;
    } else if (d < 0) { // item is lager than mid
      min = mid + 1;
    } else {
      max = mid - 1;
    }
  }
  if (options.atIndex) {
    options.atIndex(min);
  }
  return (max >= min);
}

function nextMonth(d) {
  //var n = new Date(d.getTime());
  var n = new Date(d.getFullYear(), d.getMonth())
  n.setMonth(n.getMonth() + 1)
  return n;
}

function yearMonthString(d) {
  return d.toISOString().match(/\d+-\d+/)[0];
}

var PhotoStore = {
  items: [],
  months: [],
  callbacks: {months: []},
  registerMonthsUpdate: function(callback) {
    this.callbacks.months.push(callback);
  },
  updateMonths: function() {
    var items = this.items;
    var months = [];
    if (items.length > 0) {
      var first = items[0]._date;
      var last = items[items.length - 1]._date;
      var prev = first;
      var next = nextMonth(first);
      var total = 0;
      while(next < last) {
        binSearch(items, function(e) {
          return e._date - next;
        }, {atIndex: function(i) {
          var count = i - total;
          if (count > 0) {
            months.push({date: prev, count: count});
          }
          total = i;
        }});
        prev = next;
        next = nextMonth(next);
      }
    }
    this.months = months;
  },
  load: function() {
    var options = {
      q: "mimeType contains 'image/'",
      fields: "items(id,imageMediaMetadata(date,height,width,rotation),thumbnailLink,alternateLink),nextPageToken",
      maxResults: 1000
    };
    var _retrieve = function(request) {
      console.log("retrieving...");
      request.execute(function(resp) {
        console.log("retrieving...done");
        var items = this.items;
        //items = items.concat(resp.items)
        resp.items.forEach(function(item) {
          var dateString = item.imageMediaMetadata.date; // may be in '2014:08:13 17:57:04' format
          if (dateString) {
            var m = dateString.match(/(\d{4}):(\d{2}):(.*)/);
            if (m) {
              dateString = m[1] + "/" + m[2] + "/" + m[3];
            }
          }
          item._date = dateString ? new Date(dateString) : new Date();
          //binInsert(items, item, function(a) {
          binSearch(items, function(e) {
            return e._date - item._date;
          }, {atIndex: function(i) {
            items.splice(i, 0, item);
          }});
          //this.setState({items: items});
          //items.push(item);
        });
        //this.setState({items: items});
        this.items = items;
        //this.updateMonths();
        this.callbacks.months.forEach(function(callback) {
          callback({items: items});
        });
        
        if (resp.nextPageToken) {
          options.pageToken = resp.nextPageToken;
          _retrieve(gapi.client.drive.files.list(options));
        } else {
          // finish loading
          this.callbacks.months.forEach(function(callback) {
            callback({loading: false});
          });
        }
      }.bind(this));
    }.bind(this);
    // satrt loading
    this.callbacks.months.forEach(function(callback) {
      callback({loading: true});
    });

    _retrieve(gapi.client.drive.files.list(options));
  },
  getItemsSince: function(date) {
    var index = 0;
    binSearch(this.items, function(e) {
      return e._date - date;
    }, {atIndex: function(i) {
      index = i;
    }});
    return this.items.slice(index, index + 50);
  }
};

var MonthLabel = React.createClass({
  _handleClick: function() {
    //console.log(this.props.month.date);
    this.props.selectDate(this.props.month.date);
  },
  render: function() {
    var m = this.props.month;
    var monthString = yearMonthString(m.date)
    return (
      <li key={monthString}>
        <a href="#" onClick={this._handleClick}>{monthString} ({m.count})</a>
      </li>
    );
  }
});

var PhotoApp = React.createClass({
  getInitialState: function() {
    return {
      items: [],
      months: [],
      visibleThumbCount: 50,
      visibleThumbIndex: 0,
      loading: false,
    };
  },
  // FIXME: implement componentDidUnmount
  componentDidMount: function() {
    PhotoStore.registerMonthsUpdate(function(updates) {
      this.setState(updates);
    }.bind(this));
    window.addEventListener('scroll', function(e) {
       //var y = window.scrollY;
      //console.log(window.scrollY);
      //var document.getElementsByClassName('thumb')[0]
      var total = this.state.items.length;
      var scrollY = window.scrollY;
      var contentH = document.body.offsetHeight;
      var frameH = window.innerHeight;
      var range = 2;
      var numDisplay = Math.floor(range * total * frameH / contentH);
      var thumbIndex = Math.floor((total * window.scrollY / contentH) - (numDisplay - numDisplay/range) / 2);
      //console.log("num: " + numDisplay + " index: " + thumbIndex);
      this.setState({visibleThumbCount: numDisplay, visibleThumbIndex: thumbIndex});
    }.bind(this));
  },
  // _handleScroll: function(event) {
  //   console.log(event.target.scrollTop);
  // },
  selectDate: function(date) {
    this.setState({items: PhotoStore.getItemsSince(date)});
  },
  render: function () {
    var monthNodes = this.state.months.map(function(m) {
      return <MonthLabel month={m} selectDate={this.selectDate} />;
    }.bind(this));
    //var thumbs = "";
    var thumbs = this.state.items.map(function(item, index) {
      var img = null;
      if (this.state.visibleThumbIndex <= index && index < this.state.visibleThumbIndex + this.state.visibleThumbCount) {
        var meta = item.imageMediaMetadata;
        var portrait = (Number(meta.width) < Number(meta.height)) ^ (meta.rotation == 1);
        var imgStyle = portrait ? {width: "100%"} : {height: "100%"};
        var dateLabel = item._date.toLocaleDateString();
        img = (
          <a href={item.alternateLink} target="_blank">
            <img src={item.thumbnailLink} style={imgStyle} />
            <div className="label">{dateLabel}</div>
          </a>
        );
      }
      return (
        <div key={item.id} className="thumb">
          {img}
        </div>
      );
      /*return (
        <div key={item.id} className="thumb">
          <img src={item.thumbnailLink} style={imgStyle} />
          <span>{String(item._date)}</span>
        </div>
      );*/
    }.bind(this));
    var loading = this.state.loading ? "loading..." : "";
    return (
       <div>
         <h1>Photos: {this.state.items.length} {loading}</h1>
         <ul>{monthNodes}</ul>
         <div>
           {thumbs}
         </div>
       </div>
    );
  }
});

window.App = React.renderComponent(
  <PhotoApp />,
  document.getElementById('app')
);
