# Apache configuration

## General apache config

TODO

## Shibboleth configuration

As Grasshopper is a multi-tenant application, Shibboleth authentication is not entirely standard.

Shibboleth authentication is exposed on a single domain name. For example, `shib-sp.grasshopper.local`.
Assume that a user wants to log in on an application running on `timetable.grasshopper.local`. The following steps
are involved in this:

1. On `timetable.grasshopper`, the user clicks the "Sign in with Shib" button. This will submit a form that
takes them to `https://timetable.grasshopper.local/api/auth/shibboleth`.
This endpoint will:
 - check if Shibboleth authentication is enabled for the application
 - remember the `redirectUrl` (a URL where the user needs to be redirected to when they come back)
 - redirect the user to the "Shibboleth application"

2. The user is now being redirected to `https://shib-sp.grasshopper.local/api/auth/shibboleth/sp?<signature>&<app>`
This endpoint will:
 - ensure the user came from a valid Grasshopper tenant (so we don't become an open proxy)
 - Validate some settings
 - Store which application the user came from
 - Redirect the user to `https://shib-sp.grasshopper.local/Shibboleth.SSO/Login?<service provider>`


3. Now mod_shib will take over and send the user over to their institution's IdP

4. The user authenticates at their IdP and arrives back at `https://shib-sp.grasshopper.local/api/auth/shibboleth/sp/callback`
This endpoint will:
 - ensure the mod_shib auth was succesful
 - redirect the user back to the application he came from

5. The user is back at his application at `https://timetable.grasshopper.local/api/auth/shibboleth/callback`
This endpoint will:
 - ensure the request is valid
 - initiate a user session
 - redirect the user to '/'
 - the user is now logged in
