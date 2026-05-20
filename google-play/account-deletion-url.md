# Account Deletion URL

Host the backend account deletion page publicly:

`GET /account-deletion`

Example production URL:

`https://YOUR_API_DOMAIN/account-deletion`

TODO: Replace `YOUR_API_DOMAIN` with the exact production domain after deployment.

In Google Play Console:

- Open App content.
- Open Data deletion.
- Add the public account deletion URL.

This URL must work outside the app, without requiring login. Public requests are stored as pending and must be manually verified. Authenticated in-app requests can be sent to `POST /api/app/account-deletion/request`.
