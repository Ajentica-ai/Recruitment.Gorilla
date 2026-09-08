FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Two deployments, one image definition.
#
#   /ats/  + nginx.spa.conf        behind the platform gateway, which strips
#                                  the prefix and routes /api itself
#   /      + nginx.standalone.conf `docker compose up` here, where this
#                                  container is the only origin
#
# The defaults keep the gateway build byte-identical to what it was before the
# standalone target existed; Compose passes the other pair. VITE_BASE has to be
# a build arg rather than runtime config because Vite bakes the base path into
# the emitted asset URLs.
ARG VITE_BASE=/ats/
ENV VITE_BASE=${VITE_BASE}
RUN npm run build

FROM nginx:alpine
ARG NGINX_CONF=nginx.spa.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY ${NGINX_CONF} /etc/nginx/conf.d/default.conf
EXPOSE 80
