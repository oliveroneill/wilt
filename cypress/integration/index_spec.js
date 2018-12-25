// Cypress doesn't currently support fetch, but we have a fetch polyfill to
// fallback to XHR. See https://github.com/cypress-io/cypress/issues/95
Cypress.on("window:before:load", win => {
  win.fetch = null;
  // Set constants values
  win.user = 'bla';
  win.apiGatewayEndpoint = 'https://pleasedontactuallygotothissite.com';
});

describe('Stacked Area Graph Test', () => {
  beforeEach(() => {
    // Fix date to test queries
    const now = 1545079630000;
    cy.clock(now);
    cy.server();
  });

  it('Shows loading screen', () => {
    // Stub response and never return anything
    cy.route({
      method: 'GET',
      url: '**/playsPerArtist?*',
      response: [],
      delay: 100000
    });
    cy.visit('index.html');
    cy.matchImageSnapshot('Loading screen');
  });

  it('Shows data', () => {
    const data = [
      {
          "primary_artist": "Tyler, The Creator",
          "events": [0,0,1,0,0,0,0,0,0,0,6,0,0]
      },
      {
          "primary_artist": "Bon Iver",
          "events": [0,0,0,0,0,0,0,0,0,0,0,0,3]
      }
    ];
    cy.route({
      method: 'GET',
      // Ensure correct date is queried
      url: `**/playsPerArtist?user=*&start=${1537220830}&end=${1545079630}&group_by=week`,
      response: data
    }).as('getData');
    cy.visit('index.html');
    // Wait until the request has been made
    cy.wait(['@getData']);
    cy.matchImageSnapshot('Shows data');
  });

  it('Shows at most three annotations for each point', () => {
    const data = [
      {
          "primary_artist": "Tyler, The Creator",
          "events": [0,0,11,0,0,0,0,0,0,6,0,0,11]
      },
      {
          "primary_artist": "Bon Iver",
          "events": [0,0,2,0,0,0,0,0,0,0,0,3,2]
      },
      {
          "primary_artist": "These New South Whales",
          "events": [0,0,19,0,0,1,0,0,0,1,0,1,19]
      },
      {
          "primary_artist": "Death Grips",
          "events": [0,0,10,0,0,0,0,0,0,0,0,2,6]
      }
    ];
    cy.route({
      method: 'GET',
      // Ensure correct date is queried
      url: `**/playsPerArtist?user=*&start=${1537220830}&end=${1545079630}&group_by=week`,
      response: data
    }).as('getData');
    cy.visit('index.html');
    // Wait until the request has been made
    cy.wait(['@getData']);
    cy.matchImageSnapshot('Shows at most three annotations for each point');
  });

  it('Queries past two weeks', () => {
    cy.route({
      method: 'GET',
      url: `**/playsPerArtist*`,
      response: []
    }).as('getInitData');
    cy.visit('index.html');
    // Wait for first request to finish
    cy.wait(['@getInitData']);
    // Ensure correct date is queried
    cy.route({
      method: 'GET',
      url: `**/playsPerArtist?user=*&start=${1543870030}&end=${1545079630}&group_by=week`,
      response: []
    }).as('getTwoWeeksData');
    // Change to two weeks
    cy.get('#range').click();
    cy.contains('Past two weeks').click();
    // Wait until the request has been made
    cy.wait(['@getTwoWeeksData']);
  });

  it('Queries past year', () => {
    cy.route({
      method: 'GET',
      url: `**/playsPerArtist*`,
      response: []
    }).as('getInitData');
    cy.visit('index.html');
    // Wait for first request to finish
    cy.wait(['@getInitData']);
    // Ensure correct date is queried
    cy.route({
      method: 'GET',
      url: `**/playsPerArtist?user=*&start=${1513543630}&end=${1545079630}&group_by=week`,
      response: []
    }).as('getPastYearData');
    // Change to two weeks
    cy.get('#range').click();
    cy.contains('Past year').click();
    // Wait until the request has been made
    cy.wait(['@getPastYearData']);
  });

  it('Queries past three months', () => {
    cy.route({
      method: 'GET',
      url: `**/playsPerArtist*`,
      response: []
    }).as('getInitData');
    cy.visit('index.html');
    // Wait for first request to finish
    cy.wait(['@getInitData']);
    // Ensure correct date is queried
    cy.route({
      method: 'GET',
      url: `**/playsPerArtist?user=*&start=${1537220830}&end=${1545079630}&group_by=week`,
      response: []
    }).as('getPastThreeMonths');
    // Change to two weeks
    cy.get('#range').click();
    cy.contains('Past three months').click()
    // Wait until the request has been made
    cy.wait(['@getPastThreeMonths']);
  });

  it('Queries group by day', () => {
    cy.route({
      method: 'GET',
      url: `**/playsPerArtist*`,
      response: []
    }).as('getInitData');
    cy.visit('index.html');
    // Wait for first request to finish
    cy.wait(['@getInitData']);
    // Ensure correct date is queried
    cy.route({
      method: 'GET',
      url: `**/playsPerArtist?user=*&start=${1537220830}&end=${1545079630}&group_by=day`,
      response: []
    }).as('getGroupByDay');
    // Change to two weeks
    cy.get('#groupby').click();
    cy.contains('Day').click();
    // Wait until the request has been made
    cy.wait(['@getGroupByDay']);
  });

  it('Queries group by month', () => {
    cy.route({
      method: 'GET',
      url: `**/playsPerArtist*`,
      response: []
    }).as('getInitData');
    cy.visit('index.html');
    // Wait for first request to finish
    cy.wait(['@getInitData']);
    // Ensure correct date is queried
    cy.route({
      method: 'GET',
      url: `**/playsPerArtist?user=*&start=${1537220830}&end=${1545079630}&group_by=month`,
      response: []
    }).as('getGroupByMonth');
    // Change to two weeks
    cy.get('#groupby').click();
    cy.contains('Month').click();
    // Wait until the request has been made
    cy.wait(['@getGroupByMonth']);
  });

  it('Queries group by week', () => {
    cy.route({
      method: 'GET',
      url: `**/playsPerArtist*`,
      response: []
    }).as('getInitData');
    cy.visit('index.html');
    // Wait for first request to finish
    cy.wait(['@getInitData']);
    // Ensure correct date is queried
    cy.route({
      method: 'GET',
      url: `**/playsPerArtist?user=*&start=${1537220830}&end=${1545079630}&group_by=week`,
      response: []
    }).as('getGroupByWeek');
    // Change to two weeks
    cy.get('#groupby').click();
    cy.contains('Week').click();
    // Wait until the request has been made
    cy.wait(['@getGroupByWeek']);
  });

  it('Queries custom range', () => {
    cy.route({
      method: 'GET',
      url: `**/playsPerArtist?*`,
      response: []
    }).as('getInitData');
    cy.visit('index.html');
    // Wait for first request to finish
    cy.wait(['@getInitData']);
    // Ensure correct date is queried
    cy.route({
      method: 'GET',
      url: `**/playsPerArtist?user=*&start=${1544820420}&end=${1545425220}&group_by=week`,
      response: []
    }).as('getCustomRange');
    // Change to two weeks
    cy.get('#range').click();
    cy.contains('Custom').click();
    cy.get('#range-start').click();
    cy.get('#range-start').contains('15').click();
    cy.get('#range-end').contains('22').click();
    // Wait until the request has been made
    cy.wait(['@getCustomRange']);
  });

  it('Shows error', () => {
    cy.route({
      method: 'GET',
      url: '**/playsPerArtist?*',
      status: 500,
      response: "Bad response"
    }).as('getData');
    cy.visit('index.html');
    // Wait until the request has been made
    cy.wait(['@getData']);
    cy.matchImageSnapshot('Error message');
  });
});
