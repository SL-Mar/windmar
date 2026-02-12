# SSL Certificates

Place your SSL certificates here before production deployment:

- `fullchain.pem` — Full certificate chain
- `privkey.pem` — Private key

## Generate self-signed certs for testing

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout privkey.pem -out fullchain.pem \
  -subj "/CN=windmar.local"
```

## Let's Encrypt (production)

Use certbot or acme.sh to obtain real certificates.
Mount the cert directory from the host or use a certbot sidecar container.
