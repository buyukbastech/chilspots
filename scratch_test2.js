const apiKey = 'AIzaSyD7sZadtuCgn-Tdbqt7vjUT19Sia6Oo27A';
const photoName = 'places/ChIJq1AMD9JRDhMRZSkPw1XY5gI/photos/Aa-ngMa5Ngd76tmfANiNUiL7LU0cghXAMnAARbiBBZbSynGwxy61zwekVLyImBwnA16juy6dP2kGclDB9SiV1JDYFydRmbRIO1pNBpR00AUnXvJn4CifesUZxAOM_irYIGjH-qSalSxbpyHQlJ9tssVx-j6UaFhNMwx4vuzh7UfTUOYLNHZUAwiBYwdVno8zIG8wtOol9uUOgnVXMBAPlEc-H_smS06YWxA1xFr9ljs5zKBn0UlS5UekAoogB_LwI8u5WEjT16e4RgcNLP-KUkeYWXxfq-kskWb0CQbM04XAcN3w1MWAzMZE1EoEd9rgqtRtpNgfqU1q4eDNiLg-3AprrXDn3lYhi80YyhFEKk9cSnaT749d02fAmna5XutlmnE8yY8ltbApSWo0h8D6l7t2FcnkXG9-Tc8tg8BPOHWXtrFaKQ';
const url = \https://places.googleapis.com/v1/\/media?maxHeightPx=800&maxWidthPx=1280&skipHttpRedirect=true&key=\\;
fetch(url).then(r => r.json().then(j => console.log('STATUS:', r.status, 'BODY:', j))).catch(e => console.error(e));
