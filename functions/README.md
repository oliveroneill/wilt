# Firebase functions

## playsPerArtist

Get plays per artist, grouped by periods.

### Input
`start` and `end` are unix timestamps in seconds, and `groupByTime` can be
one of these options:
- day
- week
- month

### Response
```javascript
[
    {
        "primary_artist": "Tyler, The Creator",
        "events": [0,0,1,0,0,0,0,0,0,0,6,0,0]
    },
    {
        "primary_artist": "Bon Iver",
        "events": [0,0,0,0,0,0,0,0,0,0,0,0,3]
    }
]
```
Each element in events will be a period based on `groupByTime`.
