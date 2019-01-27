Cypress.on("window:before:load", win => {
  // Cypress doesn't currently support fetch, but we have a fetch polyfill to
  // fallback to XHR. See https://github.com/cypress-io/cypress/issues/95
  win.fetch = null;
  // Set constants values
  // Disable scrollbar in tests since this breaks visual regression
  hideScrollbars(win);
  // Set constants to values that won't do anything
  win.firebaseConfig = {};
  win.apiGatewayEndpoint = "http://pleasedontactuallyhitthisendpoint/";
});

/*
 Use CSS to hide scrollbars. This only works for Chrome.
 */
function hideScrollbars(window) {
  var style = window.document.createElement('style');
  var head = window.document.querySelector('head');
  // This CSS disables scrollbars
  var scrollBarStyle = window.document.createTextNode(
    '::-webkit-scrollbar {display: none;}'
  );
  head.appendChild(style);
  style.appendChild(scrollBarStyle);
}

/**
 * Mock out the firebase functions API.
 * Input is the promise to be returned from httpsCallable
 */
function mockFirebaseFunction(promise) {
  // Create an object that we can stub
  const mockFunctions = {
    call: () => {}
  };
  const mockFirebase = {
    initializeApp: () => {},
    auth: () => {
      return {
        onAuthStateChanged: callback => {
          callback({uid: 'test_user'});
        },
        signOut: () => {}
      }
    },
    functions: () => {
      return {
        httpsCallable: (name) => mockFunctions.call
      }
    }
  };
  // Stub with the promise
  cy.stub(mockFunctions, 'call', (args) => promise);
  return mockFirebase;
}

describe('Stacked Area Graph snapshot tests', () => {

  beforeEach(() => {
    // Fix date to test queries
    const now = 1545079630000;
    cy.clock(now);
    cy.server();
    cy.viewport('macbook-15');
  });

  /****************************************
   SNAPSHOT TESTS
  ****************************************/
  it('Shows loading screen', () => {
    // Args passed into visit call to mock firebase
    const visitArgs = {
      onBeforeLoad: (win) => {
        win.firebase = mockFirebaseFunction(
          new Promise((resolve, reject) => {})
        );
      }
    };
    cy.visit('public/index.html', visitArgs);
    cy.matchImageSnapshot('Loading screen');
  });

  it('Shows error', () => {
    // Args passed into visit call to mock firebase
    const visitArgs = {
      onBeforeLoad: (win) => {
        win.firebase = mockFirebaseFunction(
          Promise.reject(new Error('testing'))
        );
      }
    };
    cy.visit('public/index.html', visitArgs);
    cy.matchImageSnapshot('Error message');
  });

  it('Shows data', () => {
    const data = [
      {
          "primary_artist": "Tyler, The Creator",
          "events": [0,0,1,0,0,0,0,0,0,0,6,0,0],
          "dates": [
            "2018-09-26",
            "2018-10-03",
            "2018-10-10",
            "2018-10-17",
            "2018-10-24",
            "2018-10-31",
            "2018-11-07",
            "2018-11-14",
            "2018-11-21",
            "2018-11-28",
            "2018-12-05",
            "2018-12-12",
            "2018-12-19"
          ]
      },
      {
          "primary_artist": "Bon Iver",
          "events": [0,0,0,0,0,0,0,0,0,0,0,0,3],
          "dates": [
            "2018-09-26",
            "2018-10-03",
            "2018-10-10",
            "2018-10-17",
            "2018-10-24",
            "2018-10-31",
            "2018-11-07",
            "2018-11-14",
            "2018-11-21",
            "2018-11-28",
            "2018-12-05",
            "2018-12-12",
            "2018-12-19"
          ]
      }
    ];
    const firebase = mockFirebaseFunction(Promise.resolve({data: data}));
    const visitArgs = {
      onBeforeLoad: (win) => {
        win.firebase = firebase;
      }
    };
    cy.visit('public/index.html', visitArgs).then(() => {
      expect(firebase.functions().httpsCallable()).to.be.calledWith(
        {start: 1537220830, end: 1545079630, group_by: 'week'}
      );
    });
    cy.matchImageSnapshot('Shows data');
  });

  it('Shows at most three annotations for each point', () => {
    const data = [
      {
          "primary_artist": "Tyler, The Creator",
          "events": [0,0,11,0,0,0,0,0,0,6,0,0,11],
          "dates": [
            "2018-09-26",
            "2018-10-03",
            "2018-10-10",
            "2018-10-17",
            "2018-10-24",
            "2018-10-31",
            "2018-11-07",
            "2018-11-14",
            "2018-11-21",
            "2018-11-28",
            "2018-12-05",
            "2018-12-12",
            "2018-12-19"
          ]
      },
      {
          "primary_artist": "Bon Iver",
          "events": [0,0,2,0,0,0,0,0,0,0,0,3,2],
          "dates": [
            "2018-09-26",
            "2018-10-03",
            "2018-10-10",
            "2018-10-17",
            "2018-10-24",
            "2018-10-31",
            "2018-11-07",
            "2018-11-14",
            "2018-11-21",
            "2018-11-28",
            "2018-12-05",
            "2018-12-12",
            "2018-12-19"
          ]
      },
      {
          "primary_artist": "These New South Whales",
          "events": [0,0,19,0,0,1,0,0,0,1,0,1,19],
          "dates": [
            "2018-09-26",
            "2018-10-03",
            "2018-10-10",
            "2018-10-17",
            "2018-10-24",
            "2018-10-31",
            "2018-11-07",
            "2018-11-14",
            "2018-11-21",
            "2018-11-28",
            "2018-12-05",
            "2018-12-12",
            "2018-12-19"
          ]
      },
      {
          "primary_artist": "Death Grips",
          "events": [0,0,10,0,0,0,0,0,0,0,0,2,6],
          "dates": [
            "2018-09-26",
            "2018-10-03",
            "2018-10-10",
            "2018-10-17",
            "2018-10-24",
            "2018-10-31",
            "2018-11-07",
            "2018-11-14",
            "2018-11-21",
            "2018-11-28",
            "2018-12-05",
            "2018-12-12",
            "2018-12-19"
          ]
      }
    ];
    const firebase = mockFirebaseFunction(Promise.resolve({data: data}));
    const visitArgs = {
      onBeforeLoad: (win) => {
        win.firebase = firebase;
      }
    };
    cy.visit('public/index.html', visitArgs).then(() => {
      expect(firebase.functions().httpsCallable()).to.be.calledWith(
        {start: 1537220830, end: 1545079630, group_by: 'week'}
      );
    });
    cy.matchImageSnapshot('Shows at most three annotations for each point');
  });

  it('Shows custom range date pickers', () => {
    const firebase = mockFirebaseFunction(Promise.resolve({data: []}));
    const visitArgs = {
      onBeforeLoad: (win) => {
        win.firebase = firebase;
      }
    };
    cy.visit('public/index.html', visitArgs);
    // Change to two weeks
    cy.get('#range').click();
    cy.contains('Custom').click();
    cy.matchImageSnapshot('Shows custom range date pickers');
  });

  it('Shows loading screen when group changes', () => {
    const firebase = mockFirebaseFunction(Promise.resolve({data: []}));
    firebase.functions().httpsCallable().onCall(1).returns(
      new Promise((resolve, reject) => {})
    );
    const visitArgs = {
      onBeforeLoad: (win) => {
        win.firebase = firebase;
      }
    };
    cy.visit('public/index.html', visitArgs);
    // Change to two weeks
    cy.get('#groupby').click();
    cy.contains('Month').click().then(() => {
      expect(firebase.functions().httpsCallable()).to.be.calledWith(
        {start: 1537220830, end: 1545079630, group_by: 'month'}
      );
    });
    cy.matchImageSnapshot('Shows loading screen when group changes');
  });

  it('Loads before login', () => {
    const blockingFirebase = {
      initializeApp: () => {},
      auth: () => {
        return {
          onAuthStateChanged: callback => {
            // Don't call callback so it'll wait forever for auth
          },
          signOut: () => {}
        }
      }
    };
    cy.visit(
      'public/index.html',
      {
        onBeforeLoad: (win) => win.firebase = blockingFirebase
      }
    );
    cy.matchImageSnapshot('Loading screen before login');
  });
});

describe('Stacked Area Graph UI assertions', () => {
  let firebase;
  let visitArgs;
  beforeEach(() => {
    // Fix date to test queries
    const now = 1545079630000;
    cy.clock(now);
    cy.server();
    cy.viewport('macbook-15');
    // Mock firebase that just returns an empty data response
    firebase = mockFirebaseFunction(Promise.resolve({data: []}));
    visitArgs = {
      onBeforeLoad: win => win.firebase = firebase
    };
  });

  it('Queries past two weeks', () => {
    cy.visit('public/index.html', visitArgs);
    // Change to two weeks
    cy.get('#range').click();
    cy.contains('Past two weeks').click().then(() => {
      expect(firebase.functions().httpsCallable()).to.be.calledWith(
        {start: 1543870030, end: 1545079630, group_by: 'week'}
      );
    });
  });

  it('Queries past year', () => {
    cy.visit('public/index.html', visitArgs);
    // Change to two weeks
    cy.get('#range').click();
    cy.contains('Past year').click().then(() => {
      expect(firebase.functions().httpsCallable()).to.be.calledWith(
        {start: 1513543630, end: 1545079630, group_by: 'week'}
      );
    });
  });

  it('Queries past three months', () => {
    cy.visit('public/index.html', visitArgs);
    // Change to two weeks
    cy.get('#range').click();
    cy.contains('Past three months').click().then(() => {
      expect(firebase.functions().httpsCallable()).to.be.calledWith(
        {start: 1537220830, end: 1545079630, group_by: 'week'}
      );
    });
  });

  it('Queries group by day', () => {
    cy.visit('public/index.html', visitArgs);
    // Change to two weeks
    cy.get('#groupby').click();
    cy.contains('Day').click().then(() => {
      expect(firebase.functions().httpsCallable()).to.be.calledWith(
        {start: 1537220830, end: 1545079630, group_by: 'day'}
      );
    });
  });

  it('Queries group by month', () => {
    cy.visit('public/index.html', visitArgs);
    // Change to two weeks
    cy.get('#groupby').click();
    cy.contains('Month').click().then(() => {
      expect(firebase.functions().httpsCallable()).to.be.calledWith(
        {start: 1537220830, end: 1545079630, group_by: 'month'}
      );
    });
  });

  it('Queries group by week', () => {
    cy.visit('public/index.html', visitArgs);
    // Change to two weeks
    cy.get('#groupby').click();
    cy.contains('Week').click().then(() => {
      expect(firebase.functions().httpsCallable()).to.be.calledWith(
        {start: 1537220830, end: 1545079630, group_by: 'week'}
      );
    });
  });

  it('Queries custom range', () => {
    cy.visit('public/index.html', visitArgs);
    // Change to two weeks
    cy.get('#range').click();
    cy.contains('Custom').click();
    cy.get('#range-start').click();
    cy.get('#range-start').contains('15').click();
    cy.get('#range-end').contains('22').click().then(() => {
      expect(firebase.functions().httpsCallable()).to.be.calledWith(
        {start: 1544820420, end: 1545425220, group_by: 'week'}
      );
    });
  });

  it('Redirects when not logged in', () => {
    const loggedOutFirebase = {
      initializeApp: () => {},
      auth: () => {
        return {
          onAuthStateChanged: callback => {
            callback(null);
          }
        }
      }
    };
    cy.visit(
      'public/index.html',
      {
        onBeforeLoad: (win) => win.firebase = loggedOutFirebase
      }
    );
    cy.location('pathname').should('eq', '/public/login.html');
  });

  it('Calls signOut when pressing logout', () => {
    // Stub response and never return anything
    cy.route({
      method: 'POST',
      url: '**/playsPerArtist*',
      response: []
    }).as('getInitData');
    let signedOut = false;
    const listeningFirebase = {
      initializeApp: () => {},
      auth: () => {
        return {
          onAuthStateChanged: callback => {
            callback({uid: 'test_user'});
          },
          signOut: () => {
            signedOut = true;
            // Need promise to stop page from erroring
            return new Promise((resolve, reject) => {});
          }
        }
      },
      functions: () => {
        return {
          httpsCallable: () => {
            return () => Promise.resolve({data: []})
          }
        }
      }
    };
    cy.visit(
      'public/index.html',
      {
        onBeforeLoad: (win) => win.firebase = listeningFirebase
      }
    );
    cy.contains('test_user').click();
    // Forcing the click was needed as it hangs over the graph and cypress
    // complained
    cy.contains('Logout').click().should(() => {
      expect(signedOut).to.be.true;
    });
  });
});
