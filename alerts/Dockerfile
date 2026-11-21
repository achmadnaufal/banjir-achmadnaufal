# The alerts service: one bundled file, no node_modules in the image.
FROM node:22.22.0-slim

ENV NODE_ENV=production
RUN useradd --system --uid 10001 --no-create-home alerts \
    && mkdir -p /data && chown alerts /data

WORKDIR /srv
COPY dist/main.cjs /srv/main.cjs

USER alerts
EXPOSE 8080
# node:sqlite is stable enough for this; hide its "experimental" banner.
CMD ["node", "--disable-warning=ExperimentalWarning", "main.cjs"]
