const apiKey = 'AIzaSyD7sZadtuCgn-Tdbqt7vjUT19Sia6Oo27A';
const textQuery = 'relaxing quiet cafe or lounge in Borgo Maggiore, San Marino';
const url = `https://places.googleapis.com/v1/places:searchText`;

fetch(url, { 
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": apiKey,
    "X-Goog-FieldMask": "places.id,places.displayName,places.photos"
  },
  body: JSON.stringify({
    textQuery: textQuery,
    languageCode: "tr",
    maxResultCount: 5
  })
}).then(r => r.json().then(j => console.log(JSON.stringify(j, null, 2)))).catch(e => console.error(e));
