---
title: Document - PhotoHistory cloud
layout: default
---
[PhotoHistory cloud](./)
==================
It displays thumbnails of all images in your [Google Drive](https://drive.google.com/).


Known Issues
------------
- If a photo contains creation date in EXIF and TIFF, Google Drive seems to prefer TIFF.


Release notes
-------------
- 2014-09-21: Try to reload thumbnail urls when they are expired.
- 2014-09-15: Experimentally caching results of files.list API requests.
- 2014-09-06: First alpha release.


TODO
----
- Google Calendar integration. (Jump to the photos on the day of an event.)
- Videos!
- Better photo viewer than just link to Google Drive.
  - I know Google Drive preview in mobile browser is teribble.


History about "PhotoHistory"
----------------------------
- Later 2011:
  - I wanted to find some photos among thousands of photos in my iPod Touch.
  - Say, photos of my son's birthday, March 2006, but it wasn't easy task.
  - So I created an iOS app, [PhotoHisotory](https://itunes.apple.com/us/app/photohistory/id473228750?mt=8).
- Sep 2013:
  - Apple releases new Photos.app, which almost satisfy my needs, so I abandoned my app.
- Early 2014:
  - Suddenly, iTunes colud not sync thousands of photos from MacBook to iPhone 5.
  - I'm not sure, but may be numbers and/or size of photos may matter...
  - Beside, photos occupy certain size of total storage of the device.
  - It's the time to think a cloud solution...
- Sep 2014:
  - PhotoHistory cloud alpha released.


Something like FAQ
------------------
- Q. It uses Google Drive. So, why not Google+ photos?
  - I know that images in Google drive can be seen in Google+ photos.
  - As for https://plus.google.com/ for Desktop browser.
    - In "All photos" we can jump to specific year and month.
    - I don' know why, but we cannot scroll back to latest photos.
  - In iPhone.
    - https://plus.google.com/ doesn't provide "All Photos" and "jump to month" feature.
    - Google+.app has "All Photos", but no "jump to month".
    - It is impossible to see "March 2006 photos".


Links
-----
- [@PhotoHistoryApp](https://twitter.com/PhotoHistoryApp)
- [hiroshi.github.io](https://hiroshi.github.io/) - My other projects
