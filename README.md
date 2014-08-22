PhotoHistoryCloud
=================

A way to see photos in Google Drive

## Note
- OS X 10.9.4 / MacBook Air (11-inch, Mid 2011)
-- Safari - works very well.
-- Chrome, Firefox - sluggish.
- iOS 7
-- iPhone 5 - works very well.
-- iPad 2 - rendering is slow.


## A guide for seting up your own Google Cloud Project

I'm not sure all these steps are must be. Feedback welcome to be clearer.

- Go to [Google Developers Console](https://console.developers.google.com/project).
-- Create a project.
-- Choose the project.
-- API & auth -> APIs
--- Enable "Drive API" and "Drive SDK".
--- Open config for "Dirve API" or "Drive SDK" by clicking the "cog" button.
- In "Drive SDK" of "Google APIs Console"
-- Input "Application Name", an "Application Icon" and "Open URL".
--- TIPS: You may be tortured by the merciless message "Your input was Invalid!" until you learn that a value for "Open URL" cannot be "http://localhost/" or something.
- Back to the project in "Google Developers Console".
-- API & auth -> Consent screen
--- Input "EMAIL ADDRESS" and "PRODUCT NAME".
-- API & auth -> Credentials -> "Create new Client ID".
--- APPLICATION TYPE: Web application
--- AUTHORIZED JAVASCRIPT ORIGINS: If you intent to test on local machine, "http://localhost:3000/" and/or "http://your-mac.local:3000" may be OK.
--- AUTHORIZED REDIRECT URI: Should be blank.
-- Copy "CLIENT ID" and paste it as CLIENT_ID in index.html.
