const apiKey = "AIzaSyD7sZadtuCgn-Tdbqt7vjUT19Sia6Oo27A";

async function test() {
  const url = `https://places.googleapis.com/v1/places:searchText`;
  const res = await fetch(url, { 
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.photos"
    },
    body: JSON.stringify({
      textQuery: "Fortress of Ghat",
      languageCode: "tr",
      maxResultCount: 2
    })
  });
  
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}

test();
