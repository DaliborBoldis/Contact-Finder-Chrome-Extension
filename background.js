/*
This is a background script, also called service worker.
Service workers are used to communicate with Chrome browser through events or browser triggers, like:
- Navigating to a new page
- Removing a bookmark
- Closing or openning a tab

IMPORTANT - Do not register listeners asynchronously, as they will not be properly triggered.
*/

var new_tabCollectionIDs = [];

var CFWebsiteDomain = "localhost";

// Async function to check if Dashboard is already opened
isDashBoardSiteOpen = async () => {
  var result;
  var t_tabs = await chrome.tabs.query({});
  t_tabs.forEach(function (t_tab) {
    if (t_tab.url.includes("localhost")) result = true;
  });
  if (result === true) {
    return true;
  }
};

GetTabIDFromURL = async (tab_url) => {
  let result;
  let t_tabs = await chrome.tabs.query({});
  t_tabs.forEach(function (t_tab) {
    if (t_tab.url == tab_url) result = t_tab.id;
  });
  return result;
};

function GetCurrentTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

String.prototype.toProperCase = function () {
  return this.replace(/\w\S*/g, function (txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
};

// Listener to handle Extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  if (!((await isDashBoardSiteOpen()) == true)) {
    const loc = "http://localhost:8080/";
    chrome.tabs.create({ url: loc, active: true }); // Open URL in new tab
  }
});

// This event is fired when a new tab is created, or if an existing tab is refreshed.
chrome.tabs.onCreated.addListener(function (tabId) {
  new_tabCollectionIDs.push(tabId.id); // Add new tab ID to the array
});

// This event is fired whenever a tab is updated. This includes all tabs in this Chrome session
chrome.tabs.onUpdated.addListener(async function (tabId, changeInfo, tab) {
  if (changeInfo.status == "complete") {
    // Check if tab completed with loading
    const tab_index = new_tabCollectionIDs.indexOf(tabId); // Find index of the ID in "new_tabCollectionIDs" array

    if (!(tab_index == undefined)) {
      // If index is not undefined or null
      new_tabCollectionIDs.splice(tab_index, 1); // Remove index from array

      var tabURL = tab.url; // Declare tab URL

      // Check if the dashboard website is opened in Chrome
      if ((await isDashBoardSiteOpen()) == true) {
        if (tabURL.includes("bing.com/") || (tabURL.includes("duckduckgo.com") && tabURL.includes("ia=web"))) {
          // If tab URL contains bing.com, inject html into the tab
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: InjectMainForm, // Inject HTML into bing page
          });
        }

        if (tabURL.includes("facebook.com/") && !tabURL.includes("/biz/")) {
          // If tab URL contains facebook.com, inject html into the tab
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: InjectAssistForm, // Inject HTML into Facebook page
          });
          console.log(GetCurrentTime() + " - Html injected to " + tabId);
        }

        if (tabURL.includes("facebook.com/") && tabURL.includes("/biz/")) {
          // If tab URL contains facebook.com, inject html into the tab
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: InjectBizForm, // Inject HTML into Facebook page
          });
          console.log(GetCurrentTime() + " - Html injected to " + tabId);
        }
      }
    }
  }
});

/*
*** Listening for external messages ***
Code below listens for messages from content scripts. Since content scripts cannot open new tabs
or interact with Chrome, we need to send a message to our background service worker (this file)
that we want a new URL opened. This file, along with opening a new URL in a new tab, also handles
injecting scripts into pages.
For more info: https://developer.chrome.com/docs/extensions/mv3/messaging/#external-webpage
*/
chrome.runtime.onMessageExternal.addListener(async function (request, sender, sendResponse) {
  const response = {
    // Declaring possible responses
    success: "success",
    failed: "failed",
  };

  // Closes currently opened tab
  if (request.method == "closetab") {
    console.log(GetCurrentTime() + " - Received command to close tab: " + request.tab_URL);
    try {
      let FindTabID = await GetTabIDFromURL(request.tab_URL);

      if (FindTabID) {
        chrome.tabs.remove(FindTabID); // Close tab
      }
    } catch (ex) {
      console.log(GetCurrentTime() + " - " + ex); // Log error
      sendResponse(response.failed);
    } finally {
      console.log(GetCurrentTime() + " - Tab closed " + request.tab_URL + " - Reason for this action: " + request.reason);
      sendResponse(response.success); // Send response that closing tab request was successful
    }
  }

  // Process Facebook URL collection - open each tab in a new window
  if (request.method == "processfacebook") {
    // If method wants to open a new Facebook URL in a new tab
    console.log(GetCurrentTime() + " - Received command to process facebook collection");
    try {
      var __fb_keys__ = request.urlCollection.map(function (tuple) {
        return tuple[0];
      });

      // let collection = request.urlCollection;
      for (let i = 0; i < __fb_keys__.length; i++) {
        const fbKey = __fb_keys__[i];

        if (!fbKey.includes("/biz/")) {
          // Check facebook key from the database
          await fetch(`http://localhost:8080/checkfacebookkey/${fbKey}`)
            .then((response) => response.json())
            .then(
              (data = async (key) => {
                if (key == "new") {
                  await new Promise((resolve) => setTimeout(resolve, 3000));

                  const loc = "https://www.facebook.com/" + fbKey + "/";
                  chrome.tabs.create({ url: loc, active: true }); // Open URL in new tab

                  console.log(GetCurrentTime() + " - New tab created: " + loc);

                  // Add facebook key to the duplicate list
                  fetch(`http://localhost:8080/insertkeytoduplicatelist/${fbKey}`);
                } else {
                  console.log(GetCurrentTime() + " - This facebook key already exists! " + fbKey);
                }
              })
            );
        } else {
          await new Promise((resolve) => setTimeout(resolve, 5000));

          const loc = fbKey;
          chrome.tabs.create({ url: loc, active: true }); // Open URL in new tab

          console.log(GetCurrentTime() + " - New tab created: " + loc);
        }
      }
    } catch (ex) {
      console.log(GetCurrentTime() + " - " + ex);
      sendResponse(response.failed); // Send response that opening tab failed
    } finally {
      sendResponse(response.success); // Send response that opening new tab was successful and initiate scraping data
      console.log(GetCurrentTime() + " - Finished processing facebook collection");
    }
  }

  // Check email from the database
  if (request.method == "checkemail") {
    console.log(GetCurrentTime() + " - Received command to check email address: " + request.email);
    fetch(`http://localhost:8080/checkemail/${request.email}`)
      .then((response) => response.json())
      .then((data) => sendResponse(data));
  }

  // Inserts data to Zoho via API
  if (request.method == "zohoAPIInsert") {
    let owner_name = request.b_owner;
    let owner_first_name;
    let owner_last_name;

    if (owner_name == "") {
      owner_first_name = "Hello";
      owner_last_name = "Hello";
    } else {
      owner_first_name = owner_name.split(" ")[0].toProperCase(); // Get owner first name from the full owner name
      owner_last_name = owner_name.substring(owner_name.indexOf(" ") + 1).toProperCase(); // Get owner last name from the full owner name
    }

    const name = request.b_name; // Get business name from request
    const phone = request.b_phone; // Get business phone from request
    let address = "";
    const towns = [
      "bethel",
      "bridgeport",
      "cos cob",
      "danbury",
      "darien",
      "fairfield",
      "greenwich",
      "new canaan",
      "norwalk",
      "ridgefield",
      "stamford",
      "westport",
      "redding",
      "sandy hook",
      "rowayton",
      "southport",
      "black rock",
      "georgetown",
      "weston",
    ]; // Hubs array

    // Get hub from address
    for (var i = 0; i < towns.length; i++) {
      if (request.b_address.toLowerCase().includes(towns[i] + ", ct")) {
        address = towns[i]; // Get business hub from full address
        break;
      }
    }

    const website = request.b_website; // Get business website from request
    const email = request.b_email; // Get business email from request
    const facebook = request.b_facebook; // Get business facebook URL from request

    await fetch("http://localhost:8080/insertRecordToZoho/", {
      // Send post request to the main website
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        owner_first_name,
        owner_last_name,
        name,
        phone,
        address,
        website,
        email,
        facebook,
      }),
    })
      .then((result) => result.json())
      .then((data) => sendResponse(data)); // Send response data
  }

  if (request.method == "InsertEmailToDuplicate") {
    console.log(GetCurrentTime() + " - Received command to add email address to duplicate list: " + request.email);
    fetch(`http://localhost:8080/addemailtoduplicates/${request.email}`)
      .then((response) => response.json())
      .then((data) => sendResponse(data));
  }
});

// Function to return currently active tab
async function getCurrentTab() {
  let queryOptions = { active: true, currentWindow: true };
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

function InjectMainForm() {
  fetch(chrome.runtime.getURL("/mainForm.html"))
    .then((r) => r.text())
    .then(async (html) => {
      if (document.URL.includes("duckduckgo")) {
        for (let i = 0; i < 2; i++) {
          const scrollingElement = document.scrollingElement || document.body;
          scrollingElement.scrollTop = scrollingElement.scrollHeight;

          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        scroll(0, 0);
      }

      document.body.insertAdjacentHTML("beforebegin", html); // If not, inject it at the top of page HTML

      var s = document.createElement("script");
      s.src = chrome.runtime.getURL("script.js");
      s.onload = function () {
        this.remove();
      };
      (document.head || document.documentElement).appendChild(s);
    });
}

function InjectAssistForm() {
  // Fetch assistForm.html into the facebook page
  fetch(chrome.runtime.getURL("/assistForm.html"))
    .then((r) => r.text())
    .then((html) => {
      document.body.insertAdjacentHTML("beforebegin", html);

      var s = document.createElement("script");
      s.src = chrome.runtime.getURL("script.js");
      s.onload = function () {
        this.remove();
      };
      (document.head || document.documentElement).appendChild(s);
    });
}

function InjectBizForm() {
  // Fetch assistForm.html into the facebook page
  fetch(chrome.runtime.getURL("/bizform.html"))
    .then((r) => r.text())
    .then((html) => {
      document.body.insertAdjacentHTML("beforebegin", html);

      var s = document.createElement("script");
      s.src = chrome.runtime.getURL("script.js");
      s.onload = function () {
        this.remove();
      };
      (document.head || document.documentElement).appendChild(s);
    });
}
