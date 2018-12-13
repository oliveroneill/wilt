// Cypress doesn't currently support fetch, but we have a fetch polyfill to
// fallback to XHR. See https://github.com/cypress-io/cypress/issues/95
Cypress.on("window:before:load", win => {
  win.fetch = null;
});

describe('Stacked Area Graph Test', () => {
  beforeEach(() => {
    cy.server();
  });

  it('Shows loading screen', () => {
    // Stub response and never return anything
    cy.route({
      method: 'GET',
      url: '**/playsPerArtist**',
      response: () => {}
    });
    cy.visit('index.html');
    cy.get('#loading').should((el) => {
      expect(el).to.have.css('display', 'block');
    });
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
    ]
    cy.route({
      method: 'GET',
      url: '**/playsPerArtist**',
      response: data
    }).as('getData');
    cy.visit('index.html');
    // Wait until the request has been made
    cy.wait(['@getData']);
    // TODO: snapshot test
  });
});
