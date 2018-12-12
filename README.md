# Wilt - What I Listen To
This is a browser client for displaying Wilt metrics.

This will display a timeline of play history for the specified user.
Inspired by [LastWave](https://github.com/taurheim/LastWave).

## Installation
Edit the `constants.js` file to specify the Google Cloud Functions backend and
username that you want to query on.

## Screenshot
The current graph is a stacked area graph for artist plays per week for a
specific user. Note: when you hover over points it will show *some*
points, however it won't show all of them.

![My play history](screenshot.png)

## TODO
- Unit testing
- Screenshot testing
- Dates on the x-axis
- Username input
- Better annotation placement
- Fix hover labels not showing every point
