 var map = L.map('map').setView([51.505, -0.09], 13);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
     minZoom: 0,
     maxZoom: 19,
     attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
 }).addTo(map);
 let codes = localStorage.getItem('codes')
 let municipalityCodes = JSON.parse(codes);
 let dataset = null
 let mapData = []
 const inputYear = document.getElementById('year-input');
 const setYear = document.getElementById('set-year');
 const inputMunicipality = document.getElementById('city-input');
 const searchMunicipality = document.getElementById('submit-city');
 inputMunicipality.value = "Alajärvi";
 let yearIndex = 0
 let geojsonLayer = null
 let isSetYear = false
 let searchResultLayer = L.layerGroup();
 searchResultLayer.addTo(map);
 let geometry = null
 let polygon = null
 async function init() {
     dataset = await getdata(municipalityCodes)
     console.log(dataset)
     const response = await fetch('https://geo.stat.fi/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=tilastointialueet:kunta4500k&outputFormat=json&srsName=EPSG:4326');
     mapData = await response.json(); // const   await
     geojsonLayer = L.geoJSON(mapData, {
         weight: 2,
         onEachFeature: function (feature, layer) {
             const municipalityName = feature.properties.nimi;
             const municipality = dataset.find((data) => data.municipalityName === municipalityName);
             if (municipality) {
                 layer.on('click', function () {
                     geometry = feature.geometry
                     polygon = L.geoJSON(geometry);
                     searchResultLayer.clearLayers();
                     localStorage.setItem('municipalityName', municipalityName);
                     searchResultLayer.addLayer(polygon);
                     let popupContent = setPopupContent(municipality);
                     layer.bindPopup(popupContent).openPopup();
                 });
             }
             layer.bindTooltip(municipalityName, { permanent: false, direction: 'auto' });
         }
     }).addTo(map);
     map.fitBounds(geojsonLayer.getBounds());
 }
 init()
 setYear.onclick = (e) => {
     e.preventDefault()
     let year = parseInt(inputYear.value);
     if (year < 1990 || year > 2022) {
         alert("Please enter a valid year between 1990 and 2022. ")
         return
     }
     yearIndex = year - 1990
     // localStorage.setItem('year',year)
     geojsonLayer.setStyle(function () {
         // const municipalityName = feature.properties.nimi;
         // const municipalityIndex = dataset.findIndex((municipality) => municipality.municipalityName === municipalityName);
         return {
             fillColor: `hsl(0, 75%, 50%)`,
             weight: 2,
             opacity: 1,
             color: 'white',
         };
     });
     isSetYear = true
 }
 searchMunicipality.onclick = (e) => {
     e.preventDefault()
     if (!isSetYear) {
         alert('Please first select the year you want to view the data distribution.')
         return
     }
     let searchName = inputMunicipality.value
     let valid = findMatchingFeature(searchName)
     searchResultLayer.clearLayers();
     if (!valid) {
         alert("The municipality cannot be found, please try again. ")
         return
     }
     geometry = valid.geometry;
     polygon = L.geoJSON(geometry);
     const municipalityName = valid.properties.nimi;
     localStorage.setItem('municipalityName', municipalityName);
     const municipality = dataset.find((data) => data.municipalityName === municipalityName);
     const popupContent = setPopupContent(municipality);
     searchResultLayer.addLayer(polygon);
     polygon.bindPopup(popupContent);
     polygon.openPopup();
     map.fitBounds(polygon.getBounds(), { maxZoom: 7 });
 }
 function findMatchingFeature(cityName) {
     for (const feature of mapData.features) {
         if (feature.properties.nimi.toLowerCase() == cityName.toLowerCase()) {
             return feature;
         }
     }
     return null;
 }
 function setPopupContent(municipality) {
     // if (municipality === undefined) 
     const index = inputYear.value - 1990;
     const municipalityName = municipality.municipalityName;
     const labourForce = municipality.labourForce[index];
     const employed = municipality.employed[index];
     const employmentRatio = municipality.employmentRatio[index].toFixed(2);
     return `
         ${municipalityName}<br>
         Labour Force: ${labourForce}<br>
         Employed: ${employed}<br>
         Employment Ratio: ${employmentRatio}%<br>
     `;
 }
 async function getdata(municipalityCodes) {
     let dataset = [];
     const jsonQuery = {
         "query": [
             {
                 "code": "Alue",
                 "selection": {
                     "filter": "item",
                     "values": municipalityCodes
                 }
             },
             {
                 "code": "Pääasiallinen toiminta",
                 "selection": {
                     "filter": "item",
                     "values": [
                         "11+12",
                         "11",
                     ]
                 }
             },
             {
                 "code": "Sukupuoli",
                 "selection": {
                     "filter": "item",
                     "values": [
                         "SSS"
                     ]
                 }
             },
             {
                 "code": "Ikä",
                 "selection": {
                     "filter": "item",
                     "values": [
                         "SSS"
                     ]
                 }
             }
         ],
         "response": {
             "format": "json-stat2"
         }
     }
     const response = await fetch('https://statfin.stat.fi:443/PxWeb/api/v1/en/StatFin/tyokay/statfin_tyokay_pxt_115b.px', {
         method: 'POST',
         headers: {
             'content-type': 'application/json'
         },
         body: JSON.stringify(jsonQuery)
     });
     if (response.status === 200) {
         const data = await response.json();
         const totalValue = data.value;
         for (let i = 0, j = 0; j < data.size[0]; i += 2, j++) {
             let municipalityName = Object.values(data.dimension.Alue.category.label)[j];
             const labourForce = totalValue.slice(i * 35, (i + 1) * 35);
             const employed = totalValue.slice((i + 1) * 35, (i + 2) * 35);
             const employmentRatio = labourForce.map((labourForce, index) => {
                 return (employed[index] / labourForce) * 100;
             });
             dataset.push({
                 municipalityName,
                 labourForce,
                 employed,
                 employmentRatio
             });
         }
     }
     else {
         console.error('Failed to fetch data.');
     }
     return dataset;
 }