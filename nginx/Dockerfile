FROM nginx:latest

RUN rm /etc/nginx/conf.d/default.conf || true

COPY ./public /usr/share/nginx/html

EXPOSE 80
