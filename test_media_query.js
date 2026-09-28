const apiKey = "AIzaSyD7sZadtuCgn-Tdbqt7vjUT19Sia6Oo27A";

async function test() {
  const photoName = "places/ChIJPyxTcWVrLRIR9_Z8B8VWzwQ/photos/Aa-ngMZy0qV42f0JID-1P_N0G630hB2_jJqg_Yf5E7t4JvU7vH_L6W-1mP-4U19X_hE3h4lE7O_3U5_JpQj_F3lK8_p3V_jM7wI_8yA3m-nLhO1v04T6T74qG1sZ7_68c6r9f_F53w_E3yN22p498gK-T49B90D8jG0bQ4UqXv9V6uI7F9uXwJ78b3s";
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=800&maxWidthPx=1280&skipHttpRedirect=true&key=${apiKey}`;
  const res = await fetch(url);
  
  if (!res.ok) {
    console.error("FAILED:", res.status, await res.text());
    return;
  }
  const json = await res.json();
  console.log("SUCCESS:", JSON.stringify(json, null, 2));
}

test();
