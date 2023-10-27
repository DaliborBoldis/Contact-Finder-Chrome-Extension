// This file is injected together with template html files
// It is used to communicate and manipulate page DOM, particularly with injected template file
// It can also manipulate the current page DOM, which is important for scraping page data
var editorExtensionId = "kagkmdephfapokgofaiabcdfahpmogjj"; // Unique extension ID

// This section handles events across all opened tabs where the user interacts with mentioned elements
// When the 'mainBar' element is loaded, scrape data automatically
var el_FacebookBarLoaded = document.getElementById("mainBarFacebook");
if (el_FacebookBarLoaded) {
  el_FacebookBarLoaded.addEventListener("load", ScrapeDataFromFacebook(), false);
}

var el_FacebookBizLoaded = document.getElementById("facebookbizform");
if (el_FacebookBizLoaded) {
  el_FacebookBizLoaded.addEventListener("load", openLinksFromFacebookBizPage(), false);
}

var el_bingEvent = document.getElementById("SaveData");
if (el_bingEvent) {
  el_bingEvent.addEventListener("click", InsertRecordZohoAPI, false);
}

// Handles Get bing data button
var el_bingEvent = document.getElementById("GetBingData");
if (el_bingEvent) {
  el_bingEvent.addEventListener("click", GetBingResults, false);
}

// Handles Scrape data button
var el_FacebookEvent = document.getElementById("ScrapeData");
if (el_FacebookEvent) {
  el_FacebookEvent.addEventListener("click", ScrapeDataFromFacebook, false);
}

// Handles Close Tab button
var el_FacebookEvent_CloseTab = document.getElementById("CloseTab");
if (el_FacebookEvent_CloseTab) {
  el_FacebookEvent_CloseTab.addEventListener("click", CloseTab, false);
}

// Handles Load next hub button from the injected HTML
var el_bingEvent_NextHub = document.getElementById("LoadNextHub");
if (el_bingEvent_NextHub) {
  el_bingEvent_NextHub.addEventListener("click", LoadNextHub, false);
}

// Handles email input field and checks if that email already exists in the database
// This event listener fetches this data from the website that is connected to the MySQL database
// Note - Chrome extensions cannot communicate with MySQL databases nor can use node.js or other java libraries
var email_element = document.getElementById("t_businessEmail");
if (email_element) {
  email_element.addEventListener("input", CheckEmails);
}

function LoadNextHub() {
  // Hubs array
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
  ];

  let nextHubFunc = (keyword) => {
    let CurrentHub, NextHub;

    for (var i = 0; i < towns.length; i++) {
      if (keyword.includes(towns[i])) {
        CurrentHub = towns[i]; // Get current hub
        NextHub = towns[i + 1]; // Get next hub from the array
      }
    }

    return [CurrentHub, NextHub];
  };

  if (document.URL.includes("bing.com")) {
    var bing_keyword = document.getElementById("sb_form_q").value.toLowerCase(); // Get bing keyword directly from bign

    let NextHub = nextHubFunc(bing_keyword);

    document.getElementById("sb_form_q").value = bing_keyword.replace(NextHub[0] + ", ct", NextHub[1] + ", ct");

    document.getElementById("sb_form_go").click();
  }

  if (document.URL.includes("duckduckgo.com")) {
    var ddgo_keyword = document.getElementById("search_form_input").value.toLowerCase();

    let NextHub = nextHubFunc(ddgo_keyword);

    document.getElementById("search_form_input").value = ddgo_keyword.replace(NextHub[0] + ", ct", NextHub[1] + ", ct");

    document.getElementById("search_button").click();
  }
}

// Process bing results to extract URL of each element (search result)
async function GetBingResults() {
  let fb_keysCollection = []; // Array to collect facebook keys. Example 'facebook.com/realestateildidemers/' - 'realestateildidemers' is key

  let x = () => {
    if (document.URL.includes("bing.com")) return document.getElementsByClassName("b_algo");

    if (document.URL.includes("duckduckgo.com")) return document.getElementsByClassName("nrn-react-div");
  };

  let results = x();

  for (let item of results) {
    // Loop through all elements
    let _facebook_Key = await ExtractURL(item.outerHTML); // Extract outerHTML of an element

    if (_facebook_Key.length > 0) {
      fb_keysCollection.push([_facebook_Key, item.textContent]);
    }
  }

  ProcessFacebookURLCollection(await RemoveDuplicateKeys(fb_keysCollection));
}

// Extracts URL from bing element and formats it for further use
function ExtractURL(content) {
  return new Promise((resolve, reject) => {
    // Extract URL from outerHTML
    var s_url = content.match(/\bhttps?:\/\/\S+/gi);
    var url = new URL(s_url[0].toLowerCase().replace("/category", "").replace("/community", ""));
    var split_result = url.pathname.split("/");

    // Detect pages that do not represent a business page
    switch (split_result[1]) {
      case "friends":
      // case "biz":
      case "category":
      case "help":
      case "groups":
      case "marketplace":
      case "instantgames": {
        resolve("");
        break;
      }

      case "biz": {
        var biz_url = url.href;

        var find_replace = { "z-upload.": "", "business.": "", "en-gb.": "", "fr-fr.": "", "%22": "" };

        biz_url = biz_url.replace(
          new RegExp(
            "(" +
              Object.keys(find_replace)
                .map(function (i) {
                  return i.replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&");
                })
                .join("|") +
              ")",
            "g"
          ),
          function (s) {
            return find_replace[s];
          }
        );

        console.log(biz_url);

        resolve(biz_url);
        break;
      }

      case "pg":
      case "pages":
      case "business": {
        resolve(split_result[2].replace("%22", ""));
        break;
      }

      default:
        resolve(split_result[1].replace("%22", ""));
        break;
    }
  });
}

// This code defines a function called RemoveDuplicateKeys() that takes an array a as an argument.
// The function creates a new array called deduplicatedArray and uses a for loop to iterate over the elements of a.
// For each element, the function uses destructuring to assign the first and second elements of the subarray to the simKey and simValue variables, respectively.
// Next, the function uses the some() method to check if deduplicatedArray contains an element that includes the value of simKey.
// If it does not, the function pushes a new array containing simKey and simValue to deduplicatedArray.
// Finally, the function returns deduplicatedArray. This array will be a copy of the original array a, but with any duplicate keys removed.

function RemoveDuplicateKeys(a) {
  var deduplicatedArray = [];
  for (var i = 0; i < a.length; i++) {
    let simKey = a[i][0];
    let simValue = a[i][1];

    if (!deduplicatedArray.some((row) => row.includes(simKey))) {
      deduplicatedArray.push([simKey, simValue]);
    }
  }

  return deduplicatedArray;
}

// A promise function to send a message to background.js to process Facebook URL collection
function ProcessFacebookURLCollection(collection) {
  console.log(collection);
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(editorExtensionId, { urlCollection: collection, method: "processfacebook" }, function (response) {
      // Get response from background.js and resolve promise
      if (response == "success") {
        // If response is successful
        console.log("Finished processing facebook list");
        resolve(response);
      }
      if (response == "failed") {
        // If response failed
        reject(response);
      }
    });
  });
}

// Handles a "Close" button on Facebook tabs
function CloseTab() {
  chrome.runtime.sendMessage(
    editorExtensionId,
    { tab_URL: document.URL, method: "closetab", reason: "Button click" },
    function (response) {
      // Get response from background.js
      if (response == "success") {
        // If response is successful
        console.info(response);
      }

      if (response == "failed") {
        // If response failed
        console.info(response);
      }
    }
  );
}

async function ScrapeDataFromFacebook() {
  var towns = [
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
  ];

  let business_name,
    business_phone,
    business_address,
    business_website,
    business_email,
    business_facebook = document.URL,
    ToCloseTab;

  let document_str = document.body.innerText.split("\n"); // Get full page text

  // Wait around 10 seconds for injected script to load
  let last_document_str_length = 0;
  for (let i = 0; i < 9; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (document.body.innerText.split("\n").length > last_document_str_length) {
      last_document_str_length = document.body.innerText.split("\n").length;
    } else {
      document_str = document.body.innerText.split("\n");
      break;
    }
  }

  // Get business name
  let GetDocumentTitle = document.title.replace(" | Facebook", "").replace("- Home", "");

  if (GetDocumentTitle.includes(" | ")) {
    let address_from_name = GetDocumentTitle.split(" | ")[1].toLowerCase().replace(" ct", "");
    if (towns.includes(address_from_name)) {
      let normalized_address = address_from_name.charAt(0).toUpperCase() + address_from_name.substr(1).toLowerCase() + ", CT";

      business_address = normalized_address;

      business_name = GetDocumentTitle.replace(" | " + GetDocumentTitle.split(" | ")[1], "");
    }
  } else {
    business_name = GetDocumentTitle;
  }
  if (business_name === undefined) business_name = GetDocumentTitle;

  business_name = business_name
    .replace(/ *\([^)]*\) */g, "")
    .replace("Co Inc", "")
    .replace("Co. Inc.", "")
    .replace("LLC", "")
    .replace("Inc", "")
    .replace("L.L.C.", "")
    .replace("inc", "")
    .replace("llc", ""); // Replace everything between parentheses

  for (var i = 0; i < business_name.length; i++) {
    if (business_name.endsWith(" ")) business_name = business_name.slice(0, -1);
    if (business_name.endsWith(".")) business_name = business_name.slice(0, -1);
    if (business_name.endsWith(",")) business_name = business_name.slice(0, -1);
  }

  const pagesFilter = [
    "add friend",
    "religious organization",
    "nonprofit organization",
    "political organization",
    "community organization",
    "nonprofit organization",
    "charity organization",
    "this page isn't available",
    "this content isn't available right now",
    "government organization",
    "religious",
    "catholic church",
    "podcast",
    "broadcasting & media production company",
    "media/news company",
    "news & media website",
    "musician/band",
    "athlete",
    "high school",
    "elementary school",
    "religious school",
    "record label",
    "private school",
    "book series",
    "k friends",
    "sports team",
    "sports league",
    "sports club",
  ];
  // Loop through document text lines
  for (let item of document_str) {
    if (pagesFilter.some((substring) => item.toLowerCase().includes(substring))) {
      ToCloseTab = true;
    }

    if (item.includes("Suggest Edits") || item.includes("Related Pages")) {
      break;
    }
    // Get business phone
    if (item.startsWith("+1") || item.startsWith("203")) {
      if (business_phone == undefined) {
        business_phone = item;
      }
    }

    // Get business address
    for (const ele of towns) {
      if (item.toLowerCase().includes(ele + ", ct ")) {
        if (business_address == undefined) {
          business_address = item;
        } else {
          break;
        }
      }
    }

    // Get business website
    if (item.startsWith("https") || item.startsWith("http") || item.startsWith("www.")) {
      if (business_website == undefined) {
        business_website = item;
      }
    }

    const extractEmail = async (a) => {
      return a.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi);
    };

    if (business_email == undefined) {
      if (item.includes("@")) {
        let email = await extractEmail(item);
        if (email) {
          business_email = email;
        }
      }
    }
  }

  if (ToCloseTab) {
    chrome.runtime.sendMessage(editorExtensionId, {
      tab_URL: document.URL,
      method: "closetab",
      reason: "Page not business",
    });
  } else {
    // Check for undefined result
    if (business_name == null) {
      business_name = "";
    }
    if (business_phone == null) {
      business_phone = "";
    }
    if (business_address == null) {
      business_address = "";
    }
    if (business_website == null) {
      business_website = "";
    }
    if (business_email == null) {
      business_email = "";
    }

    // Insert text into fields
    document.getElementById("t_businessName").value = business_name;
    document.getElementById("t_businessPhone").value = business_phone;
    document.getElementById("t_businessAddress").value = business_address;
    document.getElementById("t_businessWebsite").value = business_website;
    document.getElementById("t_businessEmail").value = business_email;
    document.getElementById("t_businessFacebook").value = business_facebook;

    // Add hub list to the dropdown menu
    var hubSelect = document.getElementById("shubs");
    // Add empty option to the first place
    var EmptyHub = document.createElement("option");
    EmptyHub.value = "";
    EmptyHub.innerText = "";
    hubSelect.appendChild(EmptyHub);

    // Add hubs to the dropdown menu
    for (const ele of towns.sort()) {
      var newHub = document.createElement("option");

      newHub.value = ele.charAt(0).toUpperCase() + ele.slice(1);
      +", CT";
      newHub.innerText = ele.charAt(0).toUpperCase() + ele.slice(1);
      +", CT";
      hubSelect.appendChild(newHub);
    }

    // Finally, check if email is duplicate and close if it appears in the database
    if (document.getElementById("t_businessEmail").value.length > 0) {
      await CheckEmails(true);
    }
  }
}

async function openLinksFromFacebookBizPage() {
  // Hubs array
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
  ];

  var links = document.getElementsByTagName("a"),
    hrefs = [];

  for (var i = 0; i < links.length; i++) {
    if (links[i].href.includes("?referrer=services_landing_page") && links[i].href.includes("/about/")) {
      towns.forEach((town) => {
        if (links[i].textContent.toLowerCase().includes(town) && links[i].textContent.toLowerCase().includes("ct")) {
          hrefs.push([links[i].href.split("https://www.facebook.com/").pop().split("/about/?")[0], links[i].textContent]);
        }
      });
    }
  }

  console.log(hrefs);

  ProcessFacebookURLCollection(await RemoveDuplicateKeys(hrefs)).then(() => {
    chrome.runtime.sendMessage(editorExtensionId, {
      tab_URL: document.URL,
      method: "closetab",
      reason: "Closing biz page",
    });
  });
}

// Check if an email that is found on Facebook page already exists in the database (see email_element event for more details)
async function CheckEmails(toCloseWindow) {
  let email_ele = document.getElementById("t_businessEmail").value;

  if (!(email_ele.length == 0)) {
    if (email_ele.includes("@")) {
      chrome.runtime.sendMessage(editorExtensionId, { email: email_ele, method: "checkemail" }, async function (response) {
        // Get response from background.js
        var popup = document.getElementById("emailPopup"); // If user is manually checking if email exists, show popup

        switch (response) {
          case "exists":
            // If response is successful and close tab if email already exists
            if (toCloseWindow == true) {
              chrome.runtime.sendMessage(editorExtensionId, {
                tab_URL: document.URL,
                method: "closetab",
                reason: "Duplicate email",
              });
            } else {
              popup.classList.toggle("show");
              popup.textContent = "Duplicate email";
            }
          // If email is new, show popup
          case "new": {
            popup.classList.toggle("show");
            popup.textContent = "Email seems alright";
          }
        }
      });
    }
  }
}

// Insert contact details into Zoho via API
function InsertRecordZohoAPI() {
  const b_owner = document.getElementById("t_businessOwner").value;
  const b_name = document.getElementById("t_businessName").value;
  const b_phone = document.getElementById("t_businessPhone").value;
  let b_address = document.getElementById("t_businessAddress").value;
  const b_website = document.getElementById("t_businessWebsite").value;
  const b_email = document.getElementById("t_businessEmail").value;
  const b_facebook = document.getElementById("t_businessFacebook").value;

  let ReadyToSendMessage = true;

  if (b_address.length == 0 && document.getElementById("shubs").value.length == 0) {
    ReadyToSendMessage = false;
    alert("Please enter an address or select hub from the drop-down menu!");
  }

  if (b_email.length == 0) {
    ReadyToSendMessage = false;
    alert("The business email field cannot be empty!");
  } else {
    if (!b_email.includes("@")) {
      ReadyToSendMessage = false;
      alert("This is not a valid email address!");
    }
  }

  if (b_facebook.length == 0 && b_website.length == 0) {
    ReadyToSendMessage = false;
    alert("Please enter the lead source - either Facebook URL or business website!");
  }

  if ((b_name.length = 0)) {
    ReadyToSendMessage = false;
    alert("The business name field cannot be empty!");
  }

  if (document.getElementById("shubs").value.length > 0) {
    b_address = document.getElementById("shubs").value + ", CT";
  }

  if (ReadyToSendMessage == true) {
    chrome.runtime.sendMessage(
      editorExtensionId,
      {
        b_owner: b_owner,
        b_name: b_name,
        b_phone: b_phone,
        b_address: b_address,
        b_website: b_website,
        b_email: b_email,
        b_facebook: b_facebook,
        method: "zohoAPIInsert", // This is the method used by listener in background.js
      },
      async function (response) {
        // Get response from background.js
        console.log(response); // Keep this for future debugging without headaches
        const server_res_CODE = response.data[0].code;
        const server_res_MESSAGE = response.data[0].message;
        const server_res_STATUS = response.data[0].status;
        const server_res_DETAILS = response.data[0].details;

        // Handling Zoho response codes
        if (server_res_CODE == "SUCCESS") {
          document.getElementById("notificationLabel").textContent = "Record added successfully";
        }

        if (server_res_CODE == "DUPLICATE_DATA") {
          document.getElementById("notificationLabel").textContent = "Record with this email already exists";
        }

        if (server_res_CODE == "INVALID_DATA") {
          document.getElementById("notificationLabel").textContent =
            "Invalid data - Please refer to the console window for more details";
        }

        if (server_res_CODE == "AUTHORIZATION_FAILED") {
          document.getElementById("notificationLabel").textContent = "You do not have sufficient privilege to add records";
        }

        if (server_res_CODE == "INTERNAL_ERROR") {
          document.getElementById("notificationLabel").textContent =
            "Internal Server Error - Please contact developer - danb@hamlethub.com";
        }

        console.log(server_res_MESSAGE);
        console.log(server_res_STATUS);
        console.log(server_res_DETAILS);

        // Add email to duplicate list of email records
        chrome.runtime.sendMessage(
          editorExtensionId,
          { email: b_email, method: "InsertEmailToDuplicate" },
          async function (response) {
            // Get response from background.js
            console.log("Adding email to the duplicate list...");
            console.log(response);
          }
        );
      }
    );
  }
}
