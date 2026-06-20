FROM dhi.io/node:26-alpine3.24-dev AS client-build
WORKDIR /app/client
ARG VITE_APP_COMMIT_SHORT=""
ENV VITE_APP_COMMIT_SHORT=${VITE_APP_COMMIT_SHORT}
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM dhi.io/node:26-alpine3.24-dev AS server-build
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY server/index.js ./index.js
COPY server/src ./src

FROM dhi.io/node:26-alpine3.24-dev AS ffmpeg-bundle
RUN apk add --no-cache ffmpeg tini libc-utils
RUN set -eux; \
    mkdir -p /ffmpeg-root/usr/bin /ffmpeg-root/sbin; \
    cp /usr/bin/ffmpeg /usr/bin/ffprobe /ffmpeg-root/usr/bin/; \
    cp /sbin/tini /ffmpeg-root/sbin/tini; \
    ldd /usr/bin/ffmpeg /usr/bin/ffprobe \
      | awk '$2 == "=>" && $3 ~ "^/" { print $3; next } $1 ~ "^/(lib|usr/lib)/" { print $1 }' \
      | sort -u \
      | while read -r lib; do \
          mkdir -p "/ffmpeg-root$(dirname "$lib")"; \
          cp "$lib" "/ffmpeg-root$lib"; \
        done

FROM dhi.io/node:26-alpine3.24 AS server
WORKDIR /app/server
COPY --from=ffmpeg-bundle /ffmpeg-root/ /
COPY --from=server-build /app/server/package.json /app/server/package.json
COPY --from=server-build /app/server/package-lock.json /app/server/package-lock.json
COPY --from=server-build /app/server/node_modules /app/server/node_modules
COPY --from=server-build /app/server/index.js /app/server/index.js
COPY --from=server-build /app/server/src /app/server/src
COPY --from=client-build /app/client/dist /app/client/dist
ENV NODE_ENV=production
ENV CLIENT_DIST=/app/client/dist
ENV ARCHIVE_ROOT=/archive
ENV CACHE_ROOT=/cache
EXPOSE 3001
ENTRYPOINT ["/sbin/tini", "--", "node", "index.js"]
CMD ["combined"]
