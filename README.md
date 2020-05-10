# Bingeparty

## Getting started

Start the signaling server

```
cd signaling_server
node index.js
```

Start the POC

```
cd standalone_poc
python -m SimpleHTTPServer 8001 .
```

## Build and run signaling locally

Build the image

```
docker build -f docker/Dockerfile -t bingeparty-signaling .
```

Run the container exposing port 8085 in the local host

```
docker run -d -p 8085:8085 bingeparty-signaling
```

## Known issues

- Sometimes the browser caches the JS, try to do a hard refresh
- The signaling server does not remove clients from the room yet, you need to restart the signaling server every time, sorry...
