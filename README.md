# Johan de Jong website

Static site in `public/`, served by the Cloudflare Worker `johanwebsite` (`src/worker.js`).
Cloudflare Workers Builds deploys every push to `main`.

## Contact form

The form on `contact.html` posts to `/api/contact`, which emails the note through
[Resend](https://resend.com). The receiving address is never sent to the browser.
The Worker needs two secrets (Worker > Settings > Variables and Secrets):

- `RESEND_API_KEY`: an API key from Resend (domain `johandejong.eu` verified there)
- `CONTACT_TO`: the inbox that receives the notes
