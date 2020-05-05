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

## Known issues
* Sometimes the browser caches the JS, try to do a hard refresh
* The signaling server does not remove clients from the room yet, you need to restart the signaling server every time, sorry...
