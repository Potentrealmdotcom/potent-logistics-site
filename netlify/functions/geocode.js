// netlify/functions/geocode.js
//
// This file runs on Netlify's server, never in the customer's browser.
// The US Census Bureau's geocoder doesn't allow direct browser calls (no CORS support),
// so this function makes the request server-side and passes the result back.
// Free, no API key, no usage limits, US addresses only — built and run by the federal government.

exports.handler = async function (event) {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    var address = event.queryStringParameters && event.queryStringParameters.address;
    if (!address) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing address parameter." }),
      };
    }

    var url = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress" +
      "?address=" + encodeURIComponent(address) +
      "&benchmark=4&format=json";

    var censusRes = await fetch(url);
    var censusData = await censusRes.json();

    var matches = censusData && censusData.result && censusData.result.addressMatches;
    if (!matches || matches.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ found: false }),
      };
    }

    var coords = matches[0].coordinates;
    var matchedAddress = matches[0].matchedAddress;

    return {
      statusCode: 200,
      body: JSON.stringify({
        found: true,
        lat: coords.y,
        lon: coords.x,
        matchedAddress: matchedAddress,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
