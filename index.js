// Parameters that will be changed via UI
let start = moment().subtract(3, 'month').unix();
let end = moment().unix();
let groupby = "week";

/*
 * To keep track of states that the UI can be in, call each
 * function to switch state
 */
const uiStates = {
  loading: () => {
    // Hide plot stuff
    document.getElementById("query-form").style.display = "none";
    document.getElementById("plot").style.display = "none";
    // Hide error
    document.getElementById("error").style.display = "none";
    // Display loading spinner
    document.getElementById("loading").style.display = "block";
  },
  error: (error) => {
    // Hide plot stuff
    document.getElementById("query-form").style.display = "none";
    document.getElementById("plot").style.display = "none";
    // Hide loading spinner
    document.getElementById("loading").style.display = "none";
    // Display error
    document.getElementById("error").style.display = "block";
    console.error('Error:', error);
  },
  customRange: (enabled) => {
    // Hide loading spinner
    document.getElementById("loading").style.display = "none";
    // Hide error
    document.getElementById("error").style.display = "none";
    // Display plot
    document.getElementById("plot").style.display = "block";
    document.getElementById("query-form").style.display = "block";
    // Show custom range if enabled
    if (enabled) {
      // For custom we just display the date picker
      // We need to use flex here so that all the form elements stay on the
      // same line
      document.getElementById("start-form").style.display = "flex";
      document.getElementById("end-form").style.display = "flex";
    } else {
      document.getElementById("start-form").style.display = "none";
      document.getElementById("end-form").style.display = "none";
    }
  },
  graph: (data, period) => {
    // Hide loading spinner
    document.getElementById("loading").style.display = "none";
    // Hide error
    document.getElementById("error").style.display = "none";
    // Display plot
    document.getElementById("plot").style.display = "block";
    document.getElementById("query-form").style.display = "block";
    // Render to a graph
    render(data, period);
  },
}

/**
 * Used to sort based on number of plays in reverse order.
 */
function comparePlaysReverse(a,b) {
  if (a.numberOfPlays < b.numberOfPlays)
    return 1;
  if (a.numberOfPlays > b.numberOfPlays)
    return -1;
  return 0;
}

/**
 * Keep annotations to a minimum to avoid business on the screen.
 * This will return a smaller set of annotations that should be displayed.
 */
function pruneAnnotations(annotations) {
  let values = []
  annotations.forEach((group) => {
    if (group.length == 0) return;
    group.sort(comparePlaysReverse);
    const mostPlayed = group[0];
    // Don't show anything if the most played is no plays
    if (mostPlayed.numberOfPlays == 0) return;
    values.push(mostPlayed);
    // If there's only one artist then we're done
    if (group.length <= 1) return;
    // Loop over at most 2 values to add as annotations
    for (let i = 1; i < 3 && i < group.length; i++) {
      if (group[i].numberOfPlays == 0) return;
      if (i < 2)
        values.push(group[i]);
      // For the final annotation, we should only show it if it's close
      // to the most played value (ie. within 10)
      else if (mostPlayed.numberOfPlays - group[i].numberOfPlays < 10)
        values.push(group[i]);
    }
  });
  return values;
}

/**
 * Pick the font size for the annotations based on number of plays
 */
function pickFontSize(numberOfPlays) {
  if (numberOfPlays > 12) return 12;
  if (numberOfPlays < 8) return 8;
  return numberOfPlays;
}

/**
 * Render data based on plotly. Period is passed in order to label
 * the plot.
 */
function render(data, period) {
  const plotDiv = document.getElementById('plot');
  let traces = [];
  let annotations = [];
  let sums = {};
  data.forEach((point) => {
    let xs = [];
    let ys = [];
    for (let i in point.events) {
      xs.push(point.dates[i]);
      ys.push(point.events[i]);
      sums[i] = (sums[i] || 0) + point.events[i];
      annotations[i] = annotations[i] || [];
      annotations[i].push(
        {
          x: point.dates[i],
          // Y value is offset because it looks better
          // TODO: figure out how to position the annotations so that they
          // don't overlap
          y: sums[i] - 5,
          // Custom value for us to keep track of the plays
          numberOfPlays: point.events[i],
          text: point.primary_artist + ' (' + point.events[i] + ' plays)',
          ax: 0,
          ay: 0,
          font: {size: pickFontSize(point.events[i])},
        }
      );
    }
    let trace = {
      x: xs,
      y: ys,
      mode: 'markers',
      name: point.primary_artist,
      showlegend: false,
      stackgroup: 'everything',
      hoverinfo: 'text'
    };
    // The hover text for each point
    const texts = ys.map((y) => {
      if (y == 0) return '';
      return point.primary_artist + ' (' + y + ' plays)';
    });
    trace['text'] = texts;
    traces.push(trace);
  });
  const pruned = pruneAnnotations(annotations);
  // Capitalise period to make it look good
  const capitalised = period.charAt(0).toUpperCase() + period.slice(1);
  const layout = {
    title: `Artist Plays Per ${capitalised}`,
    annotations: pruned
  };
  Plotly.newPlot(plotDiv, traces, layout);
}

/**
 * Query database with period as 'week', 'month' or 'day'
 */
function query(period, start, end) {
  if (!checkConstants()) return;
  // Create the query
  const query = `?user=${user}&start=${start}&end=${end}&group_by=${period}`;
  const url = `${apiGatewayEndpoint}/playsPerArtist${query}`;
  // Show loading screen
  uiStates.loading();
  // Make HTTP request to get data
  fetch(url)
    .then((response) => {
      return response.json();
    })
    .then((json) => {
      uiStates.graph(json, period);
    })
    .catch((error) => {
      uiStates.error(error);
    });
}

function checkConstants() {
  // Check that constants have been set up
  try {
    const x = user;
    const y = apiGatewayEndpoint;
  } catch (e) {
    if (e instanceof ReferenceError) {
      // Print something useful
      console.error(
        "Please create a constants.js file as specified in README.md"
      );
      uiStates.error("Please create a constants.js file");
      return false;
    }
  }
  return true;
}

/**
 * Setup dropdown listeners
 */
function setupViews() {
  // Group by form
  $('#groupby')
  .dropdown({
    action: 'activate',
    onChange: (text, value) => {
      groupby = text;
      // Query data with new interval
      query(groupby, start, end);
    }
  });

  // Custom range dropdown
  $('#range')
  .dropdown({
    action: 'activate',
    onChange: (text, value) => {
      switch(text) {
        case 'custom':
          uiStates.customRange(true);
          // Don't re-do a query
          return;
        case 'two-weeks':
          start = moment().subtract(2, 'week').unix();
          end = moment().unix();
          break;
        case 'three-months':
          start = moment().subtract(3, 'month').unix();
          end = moment().unix();
          break;
        case 'year':
          start = moment().subtract(1, 'year').unix();
          end = moment().unix();
          break;
      }
      uiStates.customRange(false);
      // Query data with new interval
      query(groupby, start, end);
    }
  });

  // The date pickers
  $('#range-start').calendar({
    type: 'date',
    endCalendar: $('#range-end'),
    onChange: (date, text, mode) => {
      // Don't query but set the start timestamp
      start = date.getTime() / 1000;
    }
  });
  $('#range-end').calendar({
    type: 'date',
    startCalendar: $('#range-start'),
    onChange: (date, text, mode) => {
      // Query now that we've set the end timestamp
      end = date.getTime() / 1000;
      query(groupby, start, end);
    }
  });
}
