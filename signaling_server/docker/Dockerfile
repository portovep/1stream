FROM node:13-alpine

WORKDIR /app

COPY docker/entrypoint.sh /app
COPY . /app

EXPOSE 8085

CMD [ "/app/entrypoint.sh" ]
