 // Firebase configuration - Replace with your Firebase project details
// Firebase configuration - Replace with your Firebase project details
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {

    apiKey: "AIzaSyAADz_7iWA5dw-zM6xTS3R-pN32-nJAEC4",
    authDomain: "safepath-a12ea.firebaseapp.com",
    databaseURL: "https://safepath-a12ea-default-rtdb.firebaseio.com/",
    projectId: "safepath-a12ea",
    storageBucket: "safepath-a12ea.firebasestorage.app",
    messagingSenderId: "188201442619",
    appId: "1:188201442619:web:e0c59a4a820f946cc5eb1e"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

// DOM Elements
const loginLogoutBtn = document.getElementById('loginLogoutBtn');
const getStartedBtn = document.getElementById('getStartedBtn');
const welcomeSection = document.getElementById('welcome-section');
const appSections = document.querySelector('.app-sections');
const loginModal = document.getElementById('loginModal');
const closeModalBtn = document.querySelector('.close-modal');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const sosBtn = document.getElementById('sosBtn');
const liveLocationBtn = document.getElementById('liveLocationBtn');
const findSafeSpotsBtn = document.getElementById('findSafeSpotsBtn');
const navLinks = document.querySelectorAll('.nav-link');
const sections = {
    home: document.getElementById('home-section'),
    safespots: document.getElementById('safespots-section'),
    profile: document.getElementById('profile-section')
};
const profileName = document.getElementById('profileName');
const profileEmail = document.getElementById('profileEmail');
const profileAvatar = document.getElementById('profileAvatar');
const emergencyMessageInput = document.getElementById('emergencyMessage');
const newContactInput = document.getElementById('newContactInput');
const addContactBtn = document.getElementById('addContactBtn');
const contactsList = document.getElementById('contactsList');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const findPoliceBtn = document.getElementById('findPoliceBtn');
const findHospitalsBtn = document.getElementById('findHospitalsBtn');
const findCafesBtn = document.getElementById('findCafesBtn');
const findStoresBtn = document.getElementById('findStoresBtn');
const statusAlert = document.getElementById('statusAlert');
const placesList = document.getElementById('placesList');
let directionsService = null;
let directionsRenderer = null;

// User data
let currentUser = null;
let userSettings = {
    emergencyMessage: "EMERGENCY: I need help! Check my location.",
    emergencyContacts: []
};

// Map variables
let map = null;
let userMarker = null;
let placesService = null;
let markers = [];

// Show status alert
function showAlert(message, type) {
    statusAlert.textContent = message;
    statusAlert.className = 'status-alert';
    statusAlert.classList.add(`alert-${type}`);
    statusAlert.style.display = 'block';

    setTimeout(() => {
        statusAlert.style.display = 'none';
    }, 5000);
}

// Toggle modal visibility
function toggleModal() {
    loginModal.classList.toggle('active');
}

// Show section
function showSection(sectionId) {
    Object.keys(sections).forEach(key => {
        sections[key].style.display = key === sectionId ? 'block' : 'none';
    });
}

// Render contacts list
function renderContacts() {
    contactsList.innerHTML = '';

    if (userSettings.emergencyContacts.length === 0) {
        contactsList.innerHTML = '<p style="color: var(--text-secondary);">No emergency contacts added yet.</p>';
        return;
    }

    userSettings.emergencyContacts.forEach((contact, index) => {
        const contactItem = document.createElement('div');
        contactItem.className = 'contact-item';

        contactItem.innerHTML = `
            <span>${contact}</span>
            <button data-index="${index}" class="delete-contact-btn">Remove</button>
        `;

        contactsList.appendChild(contactItem);
    });

    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-contact-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const index = parseInt(this.getAttribute('data-index'));
            userSettings.emergencyContacts.splice(index, 1);
            renderContacts();
        });
    });
}

// Load user settings
function loadUserSettings(userId) {
    database.ref(`users/${userId}/settings`).once('value')
        .then(snapshot => {
            const settings = snapshot.val();
            if (settings) {
                userSettings = settings;

                // Update UI
                emergencyMessageInput.value = settings.emergencyMessage || '';
                renderContacts();
            }
        })
        .catch(error => {
            console.error("Error loading settings:", error);
            showAlert("Failed to load your settings", "error");
        });
}

// Save user settings
function saveUserSettings() {
    if (!currentUser) return;

    // Update from form inputs
    userSettings.emergencyMessage = emergencyMessageInput.value || "EMERGENCY: I need help! Check my location.";

    // Save to Firebase
    database.ref(`users/${currentUser.uid}/settings`).set(userSettings)
        .then(() => {
            showAlert("Settings saved successfully", "success");
        })
        .catch(error => {
            console.error("Error saving settings:", error);
            showAlert("Failed to save settings", "error");
        });
}

function getDirections(origin, destination, destinationName) {
    // Clear existing markers but keep user marker
    markers.forEach(marker => marker.setMap(null));
    markers = [];
    
    // Request directions
    directionsService.route(
        {
            origin: origin,
            destination: destination,
            travelMode: google.maps.TravelMode.DRIVING
        },
        (response, status) => {
            if (status === google.maps.DirectionsStatus.OK) {
                // Display directions on map
                directionsRenderer.setDirections(response);
                
                // Get the route details
                const route = response.routes[0];
                const leg = route.legs[0];
                
                // Show route information
                placesList.innerHTML = `
                    <div class="direction-header">
                        <button class="back-to-places-btn" id="backToPlacesBtn">← Back to list</button>
                        <h3>Directions to ${destinationName}</h3>
                    </div>
                    <div class="route-summary">
                        <div class="route-distance">${leg.distance.text}</div>
                        <div class="route-duration">${leg.duration.text}</div>
                    </div>
                    <div class="direction-steps">
                        ${route.legs[0].steps.map((step, idx) => `
                            <div class="direction-step">
                                <div class="step-number">${idx + 1}</div>
                                <div class="step-instruction">${step.instructions}</div>
                                <div class="step-distance">${step.distance.text}</div>
                            </div>
                        `).join('')}
                    </div>
                `;
                
                // Add event listener to back button
                document.getElementById('backToPlacesBtn').addEventListener('click', () => {
                    // Clear directions
                    directionsRenderer.setDirections({routes: []});
                    
                    // Refetch places to restore the list and markers
                    const activeButtonId = 
                        findPoliceBtn.classList.contains('active') ? 'police' :
                        findHospitalsBtn.classList.contains('active') ? 'hospital' :
                        findCafesBtn.classList.contains('active') ? 'cafe' :
                        findStoresBtn.classList.contains('active') ? 'store' : null;
                        
                    if (activeButtonId) {
                        findNearbyPlaces(activeButtonId);
                    }
                });
                
            } else {
                console.error("Directions request failed:", status);
                showAlert(`Failed to get directions: ${status}`, "error");
            }
        }
    );
}

// Get current location
function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject("Geolocation is not supported by your browser");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            position => resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                timestamp: new Date().toISOString()
            }),
            error => reject(`Error getting location: ${error.message}`),
            { enableHighAccuracy: true }
        );
    });
}
// Start tracking live location
let locationTrackingId = null;

function startLiveLocation() {
    if (!currentUser) {
        showAlert("Please login to share your location", "warning");
        return;
    }

    if (locationTrackingId) {
        showAlert("Already sharing location", "warning");
        return;
    }

    locationTrackingId = navigator.geolocation.watchPosition(
        position => {
            const locationData = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                timestamp: new Date().toISOString(),
                accuracy: position.coords.accuracy,
                userId: currentUser.uid,
                isActive: true,
                displayName: currentUser.displayName || "User"
            };

            // Save to Firebase
            database.ref(`users/${currentUser.uid}/location`).set(locationData)
                .then(() => console.log("Location updated successfully"))
                .catch(error => console.error("Error updating location:", error));

            // Update map marker
            if (map && userMarker) {
                const newPosition = new google.maps.LatLng(locationData.latitude, locationData.longitude);
                userMarker.setPosition(newPosition);
                map.setCenter(newPosition);
            }
        },
        error => {
            showAlert(`Location tracking error: ${error.message}`, "error");
            stopLiveLocation();
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    );

    showAlert("Live location sharing started", "success");
    liveLocationBtn.innerHTML = `<span>⏹️</span> Live Sharing Done`;
}

// Stop tracking live location
 function stopLiveLocation() {
    if (locationTrackingId) {
        navigator.geolocation.clearWatch(locationTrackingId);
        locationTrackingId = null;

        if (currentUser) {
            database.ref(`users/${currentUser.uid}/location`).update({ isActive: false });
            console.log("Location sharing stopped");
        }

        // Reset UI
        liveLocationBtn.innerHTML = `<span>📍</span> Start Live Location`;
        liveLocationBtn.onclick = startLiveLocation;  // Rebind the function
        showAlert("Location sharing stopped", "success");
    }
}





// Send SOS alert with location
async function sendSOS() {
    if (!currentUser) {
        showAlert("Please login to send SOS", "warning");
        return;
    }

    try {
        // Start location sharing if not already active
        if (!locationTrackingId) {
            startLiveLocation();
        }

        // Fetch the latest live location from Firebase
        const locationSnapshot = await database.ref(`users/${currentUser.uid}/location`).once('value');
        const liveLocation = locationSnapshot.val();

        // Check if live location is available and active
        if (!liveLocation || !liveLocation.isActive) {
            showAlert("Live location not available. Please wait...", "warning");
            return;
        }

        // Get emergency contacts from settings
        const contacts = userSettings.emergencyContacts;
        if (contacts.length === 0) {
            showAlert("Please add emergency contacts in your profile first", "warning");
            showSection('profile');
            return;
        }

        

        // Create SOS alert data using live location from Firebase
        const sosData = {
            message: userSettings.emergencyMessage,
            location: {
                latitude: liveLocation.latitude,
                longitude: liveLocation.longitude,
                timestamp: liveLocation.timestamp
            },
            timestamp: new Date().toISOString(),
            userId: currentUser.uid,
            userName: currentUser.displayName || "User",
            status: "active",
            contacts: contacts
        };

        // Save SOS alert to Firebase
        const newSosRef = database.ref('sos').push();
        await newSosRef.set(sosData);

        // Send messages to each emergency contact via WhatsApp
        for (const contact of contacts) {
            // Prepare WhatsApp link with message and location
            const mapsUrl = `https://maps.google.com/?q=${liveLocation.latitude},${liveLocation.longitude}`;
            const whatsappMessage = encodeURIComponent(`${userSettings.emergencyMessage} My current location: ${mapsUrl}`);
            const whatsappLink = `https://wa.me/${contact}?text=${whatsappMessage}`;

            // Open WhatsApp link in a new tab
            window.open(whatsappLink, '_blank');
        }

        // Show success message
        showAlert("SOS alert sent successfully!", "success");
    } catch (error) {
        console.error("Error sending SOS:", error);
        showAlert("Failed to send SOS alert", "error");
    }
}

async function sendLiveLocation() {
    if (!currentUser) {
        showAlert("Please login to send LiveLocation", "warning");
        return;
    }

    try {
        console.log("Fetching live location from Firebase...");
        const locationSnapshot = await database.ref(`users/${currentUser.uid}/location`).once('value');
        let liveLocation = locationSnapshot.val();
        console.log("Fetched Live Location:", liveLocation);

        // If location is missing or inactive, restart tracking
        if (!liveLocation || !liveLocation.isActive) {
            showAlert("Live location is inactive. Restarting tracking...", "warning");
            await startLiveLocation();  // Make sure tracking starts
            await new Promise(resolve => setTimeout(resolve, 2000)); // Small delay to allow Firebase update
            liveLocation = (await database.ref(`users/${currentUser.uid}/location`).once('value')).val(); // Fetch updated location
        }

        // Validate location
        if (!liveLocation || !liveLocation.latitude || !liveLocation.longitude) {
            showAlert("Failed to fetch updated location. Try again.", "error");
            return;
        }

        // Get emergency contacts
        const contacts = userSettings.emergencyContacts;
        if (contacts.length === 0) {
            showAlert("Please add emergency contacts in your profile first", "warning");
            showSection('profile');
            return;
        }

        // Send Live Location
        const liveLocationData = {
            location: {
                latitude: liveLocation.latitude,
                longitude: liveLocation.longitude,
                timestamp: liveLocation.timestamp
            },
            timestamp: new Date().toISOString(),
            userId: currentUser.uid,
            userName: currentUser.displayName || "User",
            status: "active",
            contacts: contacts
        };

        // Save to Firebase
        await database.ref(`live_location`).push(liveLocationData);

        // Send WhatsApp messages
        for (const contact of contacts) {
            const mapsUrl = `https://maps.google.com/?q=${liveLocation.latitude},${liveLocation.longitude}`;
            const whatsappMessage = encodeURIComponent(`I'm sharing my live location. Track me here: ${mapsUrl}`);
            window.open(`https://wa.me/${contact}?text=${whatsappMessage}`, '_blank');
        }

        showAlert("Live Location alert sent successfully!", "success");
    } catch (error) {
        console.error("Error sending Live Location:", error);
        showAlert("Failed to send Live Location alert", "error");
    }
}

      



// Initialize Google Maps
function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 0, lng: 0 },
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        styles: [
            {
                featureType: "poi",
                elementType: "labels",
                stylers: [{ visibility: "off" }]
            }
        ]
    });

    placesService = new google.maps.places.PlacesService(map);
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({ map: map, suppressMarkers: false });


    // Add user marker
    userMarker = new google.maps.Marker({
        map: map,
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#4285F4',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2
        }
    });

    // Center map on user's location
    getCurrentLocation()
        .then(location => {
            const userPosition = new google.maps.LatLng(location.latitude, location.longitude);
            map.setCenter(userPosition);
            userMarker.setPosition(userPosition);
        })
        .catch(error => {
            console.error("Error getting initial location:", error);
            showAlert("Failed to get your location", "error");
        });
}

// Find nearby places
function findNearbyPlaces(type) {
    if (!map || !placesService) {
        showAlert("Map or Places service is not initialized", "error");
        return;
    }

     // Clear existing markers and directions
     markers.forEach(marker => marker.setMap(null));
    markers = [];
    directionsRenderer.setDirections({ routes: [] });

    
    // Clear places list
    placesList.innerHTML = '';
    
    // Show loading indicator in places list
    placesList.innerHTML = '<div class="loading-places">Searching for nearby ' + type + '...</div>';

    getCurrentLocation()
        .then(location => {
            const userPosition = new google.maps.LatLng(location.latitude, location.longitude);

            const request = {
                location: userPosition,
                radius: '5000',
                type: [type]
            };

            placesService.nearbySearch(request, (results, status) => {
                placesList.innerHTML = '';
                if (status === google.maps.places.PlacesServiceStatus.OK) {
                    const listHeader = document.createElement('div');
                    listHeader.innerHTML = `<h3>Nearby ${type.charAt(0).toUpperCase() + type.slice(1)}s</h3>`;
                    placesList.appendChild(listHeader);
                     // Add each place to the list
                     results.forEach((place, index) => {
                        // Create marker with color based on type
                        let markerColor;
                        switch(type) {
                            case 'police':
                                markerColor = '#2196f3'; // Blue
                                break;
                            case 'hospital':
                                markerColor = '#f44336'; // Red
                                break;
                            case 'cafe':
                                markerColor = '#4caf50'; // Green
                                break;
                            case 'store':
                                markerColor = '#ff9800'; // Orange
                                break;
                            default:
                                markerColor = '#9c27b0'; // Purple
                        }
                        
                        const marker = new google.maps.Marker({
                            map: map,
                            position: place.geometry.location,
                            title: place.name,
                            icon: {
                                path: google.maps.SymbolPath.CIRCLE,
                                scale: 8,
                                fillColor: markerColor,
                                fillOpacity: 1,
                                strokeColor: '#FFFFFF',
                                strokeWeight: 2
                            },
                            label: {
                                text: (index + 1).toString(),
                                color: '#FFFFFF',
                                fontSize: '12px'
                            }
                        });

                        markers.push(marker);
                        
                        // Add info window
                        const infoWindow = new google.maps.InfoWindow({
                            content: `<div class="info-window">
                                <h4>${place.name}</h4>
                                <p>${place.vicinity || ''}</p>
                                <p>Rating: ${place.rating ? place.rating + '/5' : 'N/A'}</p>
                                <button id="directions-${index}" class="direction-btn">Get Directions</button>
                            </div>`
                        });
                        
                        marker.addListener('click', () => {
                            infoWindow.open(map, marker);
                        });
                        
                        // Create place item for the list
                        const placeItem = document.createElement('div');
                        placeItem.className = 'place-item';
                        placeItem.innerHTML = `
                            <div class="place-number" style="background-color: ${markerColor}">${index + 1}</div>
                            <div class="place-details">
                                <div class="place-name">${place.name}</div>
                                <div class="place-address">${place.vicinity || ''}</div>
                                <div class="place-rating">
                                    ${place.rating ? '★'.repeat(Math.round(place.rating)) + '☆'.repeat(5 - Math.round(place.rating)) + ' ' + place.rating.toFixed(1) : 'No ratings'}
                                </div>
                            </div>
                            <button class="list-direction-btn" data-index="${index}">Directions</button>
                        `;
                        
                        placesList.appendChild(placeItem);
                        
                        // Add event listener for the "Get Directions" button in info window
                        google.maps.event.addListener(infoWindow, 'domready', () => {
                            document.getElementById(`directions-${index}`).addEventListener('click', () => {
                                getDirections(userPosition, place.geometry.location, place.name);
                            });
                        });
                    });
                    
                    // Add event listeners to direction buttons in the list
                    document.querySelectorAll('.list-direction-btn').forEach(btn => {
                        btn.addEventListener('click', function() {
                            const index = parseInt(this.getAttribute('data-index'));
                            const place = results[index];
                            getDirections(userPosition, place.geometry.location, place.name);
                        });
                    });
                    
                } else {
                    console.error("Places API error:", status);
                    placesList.innerHTML = `<div class="no-places">No ${type}s found nearby. Try another category.</div>`;
                    showAlert(`Failed to find nearby ${type}: ${status}`, "error");
                }
            });
        })
        .catch(error => {
            console.error("Error getting location:", error);
            showAlert("Failed to get your location", "error");
        });
}

function getMarkerColor(type) {
    switch (type) {
        case 'police': return '#2196f3'; // Blue
        case 'hospital': return '#f44336'; // Red
        case 'cafe': return '#4caf50'; // Green
        case 'store': return '#ff9800'; // Orange
        default: return '#9c27b0'; // Purple
    }
}

// Helper function to create a marker
function createMarker(position, title, color, index) {
    return new google.maps.Marker({
        map: map,
        position: position,
        title: title,
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2
        },
        label: {
            text: (index + 1).toString(),
            color: '#FFFFFF',
            fontSize: '12px'
        }
    });
}

// Helper function to create a place item for the list
function createPlaceItem(place, index, color) {
    const placeItem = document.createElement('div');
    placeItem.className = 'place-item';
    placeItem.innerHTML = `
        <div class="place-number" style="background-color: ${color}">${index + 1}</div>
        <div class="place-details">
            <div class="place-name">${place.name}</div>
            <div class="place-address">${place.vicinity || ''}</div>
            <div class="place-rating">
                ${place.rating ? '★'.repeat(Math.round(place.rating)) + '☆'.repeat(5 - Math.round(place.rating)) + ' ' + place.rating.toFixed(1) : 'No ratings'}
            </div>
        </div>
        <button class="list-direction-btn" data-index="${index}">Directions</button>
    `;
    return placeItem;
}

// Handle user authentication state changes
auth.onAuthStateChanged(user => {
    if (user) {
        // User is signed in
        currentUser = user;
        loginLogoutBtn.textContent = "Logout";
        welcomeSection.style.display = "none";
        appSections.style.display = "block";
        showSection('home');

        // Load user settings
        loadUserSettings(user.uid);

        // Update profile info
        profileName.textContent = user.displayName || "User";
        profileEmail.textContent = user.email;
        profileAvatar.src = user.photoURL || "/api/placeholder/60/60";
    } else {
        // User is signed out
        currentUser = null;
        loginLogoutBtn.textContent = "Login";
        welcomeSection.style.display = "block";
        appSections.style.display = "none";
        stopLiveLocation();
    }
});

// Event Listeners
getStartedBtn.addEventListener('click', toggleModal);
loginLogoutBtn.addEventListener('click', () => {
    if (currentUser) {
        auth.signOut();
    } else {
        toggleModal();
    }
});

closeModalBtn.addEventListener('click', toggleModal);
googleLoginBtn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then(() => {
            toggleModal();
        })
        .catch(error => {
            console.error("Google login error:", error);
            showAlert("Failed to login with Google", "error");
        });
});

sosBtn.addEventListener('click', sendSOS);
liveLocationBtn.addEventListener('click', () => {
    if (locationTrackingId) {
        stopLiveLocation();
    } else {
        startLiveLocation();
    }
});


liveLocationBtn.addEventListener('click', sendLiveLocation);
liveLocationBtn.addEventListener('click', () => {
    if (locationTrackingId) {
        stopLiveLocation();
    } else {
        startLiveLocation();
    }
});

findSafeSpotsBtn.addEventListener('click', () => showSection('safespots'));
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const section = link.getAttribute('data-section');
        showSection(section);
    });
});

addContactBtn.addEventListener('click', () => {
    const phoneNumber = newContactInput.value.trim();
    if (phoneNumber && !userSettings.emergencyContacts.includes(phoneNumber)) {
        userSettings.emergencyContacts.push(phoneNumber);
        renderContacts();
        newContactInput.value = '';
    } else {
        showAlert("Invalid or duplicate phone number", "warning");
    }
});

saveSettingsBtn.addEventListener('click', saveUserSettings);

findPoliceBtn.addEventListener('click', () => {
    resetActiveButtons();
    findPoliceBtn.classList.add('active');
    showSection('safespots');
    findNearbyPlaces('police');
});

findHospitalsBtn.addEventListener('click', () => {
    resetActiveButtons();
    findHospitalsBtn.classList.add('active');
    showSection('safespots');
    findNearbyPlaces('hospital');
});

findCafesBtn.addEventListener('click', () => {
    resetActiveButtons();
    findCafesBtn.classList.add('active');
    showSection('safespots');
    findNearbyPlaces('cafe');
});

findStoresBtn.addEventListener('click', () => {
    resetActiveButtons();
    findStoresBtn.classList.add('active');
    showSection('safespots');
    findNearbyPlaces('store');
});

// Helper function to reset active buttons
function resetActiveButtons() {
    findPoliceBtn.classList.remove('active');
    findHospitalsBtn.classList.remove('active');
    findCafesBtn.classList.remove('active');
    findStoresBtn.classList.remove('active');
}

window.addEventListener('load', function () {
    // Find our button elements
    const emergencyCallBtn = document.getElementById('emergencyCallBtn');

    // Debug check - make sure we found the button
    console.log("Emergency call button found:", emergencyCallBtn);

    if (!emergencyCallBtn) {
        console.error("Emergency call button not found in the DOM");
        return; // Exit if button doesn't exist
    }

    // Make sure we have a modal
    let emergencyCallModal = document.getElementById('emergencyCallModal');

    // If modal doesn't exist, create it
    if (!emergencyCallModal) {
        console.log("Creating emergency call modal");
        const modalHtml = `
            <div id="emergencyCallModal" class="modal-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background-color:rgba(0,0,0,0.7); z-index:1000; justify-content:center; align-items:center;">
                <div class="modal-content emergency-modal" style="background-color:white; padding:20px; border-radius:5px; max-width:400px; text-align:center;">
                    <h2 class="modal-title">Emergency Call</h2>
                    <p>This will call emergency services (112) and share your current location.</p>
                    <div class="emergency-actions" style="display:flex; justify-content:center; gap:10px; margin-top:20px;">
                        <button id="confirmEmergencyCallBtn" class="btn btn-red">
                            <span>📞</span>
                            Call 112 Now
                        </button>
                        <button id="cancelEmergencyCallBtn" class="btn btn-grey">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Append modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        emergencyCallModal = document.getElementById('emergencyCallModal');
    }

    // Direct implementation - handle the click immediately
    emergencyCallBtn.onclick = function () {
        console.log("Emergency call button clicked");

        // Simple confirmation
        if (confirm("Do you want to call emergency services (112)?")) {
            console.log("Initiating emergency call");

            // Try to get location if available
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    function (position) {
                        console.log("Got location:", position.coords.latitude, position.coords.longitude);
                        // Proceed with call
                        makeEmergencyCall();
                    },
                    function (error) {
                        console.error("Location error:", error);
                        // Still make the call even without location
                        makeEmergencyCall();
                    }
                );
            } else {
                // Geolocation not supported
                console.log("Geolocation not supported");
                makeEmergencyCall();
            }
        }
    };

    // Function to make the emergency call
    function makeEmergencyCall() {
        // Use the tel: protocol to initiate the call
        window.location.href = "tel:112";

        // Show the notification
        showNotification("Initiating call to emergency services (112)...");
    }

    // Function to show a notification
    function showNotification(message) {
        const notification = document.getElementById('notification');
        if (!notification) {
            console.error("Notification div not found");
            return;
        }

        // Set the message
        notification.textContent = message;

        // Show the notification with smooth transition
        notification.style.display = 'block';
        setTimeout(() => {
            notification.classList.add('show');
        }, 10); // Small delay to trigger the transition

        // Hide the notification after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.style.display = 'none';
            }, 500); // Wait for the fade-out transition to complete
        }, 3000);
    }
});

// Initialize Google Maps when the window loads
window.onload = () => {
    initMap();
};

/**
 * Invisible Emergency Voice Listener with Auto SOS Button Trigger
 * This script runs in the background, listens for emergency phrases,
 * and automatically triggers the existing SOS button functionality.
 */

// Configuration
const emergencyConfig = {
    // Emergency trigger phrases (lowercase)
    triggerPhrases: ['help me', 'emergency', 'sos', 'help', 'danger', 'call for help'],
    
    // Auto-start listening when script loads
    autoStart: true,
    
    // Auto-restart if recognition stops
    autoRestart: true,
    
    // SOS button selector - MODIFY THIS to match your existing SOS button
    sosButtonSelector: '#sosBtn, .btn-red, [data-action="sos"]',
    
    // Alternative function name if button click doesn't work
    sosFunctionName: 'triggerSOS'
};

// Main emergency listener controller
const EmergencyListener = (function() {
    let recognition = null;
    let isListening = false;
    let lastRestartTime = 0;
    
    // Initialize speech recognition
    function initSpeechRecognition() {
        // Check browser support
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.error('Speech recognition not supported in this browser.');
            return false;
        }
        
        // Create speech recognition instance
        recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        
        // Set up event handlers
        recognition.onstart = function() {
            isListening = true;
            console.log('[Emergency Listener] Voice recognition started and running in background');
        };
        
        recognition.onresult = function(event) {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript.toLowerCase().trim();
                
                if (event.results[i].isFinal) {
                    console.log(`[Emergency Listener] Recognized: "${transcript}"`);
                    
                    // Check for emergency triggers
                    const foundTrigger = emergencyConfig.triggerPhrases.find(trigger => 
                        transcript.includes(trigger));
                    
                    if (foundTrigger) {
                        console.log(`[EMERGENCY DETECTED] Triggered by phrase: "${foundTrigger}"`);
                        handleEmergency(foundTrigger);
                    }
                }
            }
        };
        
        recognition.onerror = function(event) {
            console.log(`[Emergency Listener] Error: ${event.error}`);
        };
        
        recognition.onend = function() {
            isListening = false;
            console.log('[Emergency Listener] Voice recognition ended');
            
            // Auto-restart if configured and not manually stopped
            if (emergencyConfig.autoRestart) {
                const now = Date.now();
                // Prevent restart loops by requiring at least 1 second between restarts
                if (now - lastRestartTime > 1000) {
                    lastRestartTime = now;
                    try {
                        console.log('[Emergency Listener] Auto-restarting voice recognition...');
                        recognition.start();
                    } catch (e) {
                        console.error('[Emergency Listener] Failed to restart voice recognition:', e);
                    }
                } else {
                    console.warn('[Emergency Listener] Restart throttled to prevent loop');
                    // Try again in 3 seconds
                    setTimeout(startListening, 3000);
                }
            }
        };
        
        return true;
    }
    
    // Start listening for voice commands
    function startListening() {
        if (!recognition && !initSpeechRecognition()) {
            return false;
        }
        
        if (isListening) {
            return true; // Already listening
        }
        
        try {
            recognition.start();
            isListening = true;
            return true;
        } catch (e) {
            console.error('[Emergency Listener] Error starting recognition:', e);
            return false;
        }
    }
    
    // Stop listening
    function stopListening() {
        if (recognition && isListening) {
            try {
                recognition.stop();
                isListening = false;
                console.log('[Emergency Listener] Stopped listening');
                return true;
            } catch (e) {
                console.error('[Emergency Listener] Error stopping recognition:', e);
                return false;
            }
        }
        return false;
    }
    
    // Handle emergency situation by triggering SOS button
    function handleEmergency(trigger) {
        console.log(`[EMERGENCY PROTOCOL ACTIVATED] Triggered by: "${trigger}"`);
        
        // First, get current location to log it
        getLocation()
            .then(locationData => {
                // Log the location that will be sent
                console.log('[EMERGENCY] Location data that will be shared:', locationData);
            })
            .catch(error => {
                console.error('[EMERGENCY] Could not get location:', error);
            })
            .finally(() => {
                // Trigger the SOS button or function regardless of location result
                triggerSOSButton();
            });
    }
    
    // Get current location
    function getLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject('Geolocation not supported');
                return;
            }
            
            navigator.geolocation.getCurrentPosition(
                position => {
                    const locationData = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: position.timestamp,
                        mapLink: `https://maps.google.com/?q=${position.coords.latitude},${position.coords.longitude}`
                    };
                    resolve(locationData);
                },
                error => {
                    reject(error.message);
                },
                { 
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });
    }
    
    // Trigger the existing SOS button functionality
    function triggerSOSButton() {
        console.log('[EMERGENCY] Attempting to trigger SOS button');
        
        // Attempt to find and click the SOS button
        const sosButton = document.querySelector(emergencyConfig.sosButtonSelector);
        
        if (sosButton) {
            console.log('[EMERGENCY] SOS button found, triggering click event');
            
            // Create and dispatch click event
            try {
                // Try modern event approach
                const clickEvent = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                sosButton.dispatchEvent(clickEvent);
                console.log('[EMERGENCY] SOS button clicked programmatically');
                return true;
            } catch (e) {
                // Fallback to legacy approach
                console.warn('[EMERGENCY] Modern click event failed, trying legacy approach:', e);
                try {
                    const legacyEvent = document.createEvent('MouseEvents');
                    legacyEvent.initEvent('click', true, true);
                    sosButton.dispatchEvent(legacyEvent);
                    console.log('[EMERGENCY] SOS button clicked with legacy event');
                    return true;
                } catch (e2) {
                    console.error('[EMERGENCY] Legacy click event also failed:', e2);
                }
            }
        } else {
            console.warn('[EMERGENCY] SOS button not found with selector:', emergencyConfig.sosButtonSelector);
        }
        
        // If button not found or click failed, try to call a global SOS function
        console.log('[EMERGENCY] Attempting to call SOS function');
        
        // Try calling the global SOS function if it exists
        if (typeof window[emergencyConfig.sosFunctionName] === 'function') {
            try {
                window[emergencyConfig.sosFunctionName]();
                console.log(`[EMERGENCY] Successfully called ${emergencyConfig.sosFunctionName}() function`);
                return true;
            } catch (e) {
                console.error(`[EMERGENCY] Error calling ${emergencyConfig.sosFunctionName}() function:`, e);
            }
        } else {
            console.error(`[EMERGENCY] ${emergencyConfig.sosFunctionName}() function not found in global scope`);
        }
        
        // Last resort - check common SOS function names and call the first one found
        const commonSOSFunctions = [
            'sendSOS', 'activateSOS', 'triggerEmergency', 'sendEmergencyAlert', 
            'emergencyFunction', 'sosAlert', 'callEmergencyContact'
        ];
        
        for (const funcName of commonSOSFunctions) {
            if (typeof window[funcName] === 'function') {
                try {
                    console.log(`[EMERGENCY] Trying common function: ${funcName}()`);
                    window[funcName]();
                    console.log(`[EMERGENCY] Successfully called ${funcName}() function`);
                    return true;
                } catch (e) {
                    console.error(`[EMERGENCY] Error calling ${funcName}() function:`, e);
                }
            }
        }
        
        console.error('[EMERGENCY] All attempts to trigger SOS functionality failed');
        return false;
    }
    
    // Test emergency function (can be called programmatically)
    function testEmergency() {
        console.log('[Emergency Listener] Running emergency test');
        handleEmergency('test');
    }
    
    // Public API
    return {
        init: function() {
            console.log('[Emergency Listener] Initializing invisible emergency voice listener');
            console.log('[Emergency Listener] Will trigger SOS button/function when activated');
            initSpeechRecognition();
            if (emergencyConfig.autoStart) {
                startListening();
            }
            return this;
        },
        start: startListening,
        stop: stopListening,
        test: testEmergency,
        isListening: function() { return isListening; },
        updateSOSSelector: function(selector) {
            if (selector && typeof selector === 'string') {
                emergencyConfig.sosButtonSelector = selector;
                console.log('[Emergency Listener] Updated SOS button selector to:', selector);
            }
        },
        updateSOSFunction: function(functionName) {
            if (functionName && typeof functionName === 'string') {
                emergencyConfig.sosFunctionName = functionName;
                console.log('[Emergency Listener] Updated SOS function name to:', functionName);
            }
        },
        setTriggerPhrases: function(phrases) {
            if (Array.isArray(phrases) && phrases.length > 0) {
                emergencyConfig.triggerPhrases = phrases.map(p => p.toLowerCase());
                console.log('[Emergency Listener] Updated trigger phrases:', emergencyConfig.triggerPhrases);
            }
        }
    };
})();

/**
 * Initialize the emergency listener
 * Call this function to start the background listener
 */
function initEmergencyListener() {
    return EmergencyListener.init();
}

// Auto-initialize when script is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEmergencyListener);
} else {
    initEmergencyListener();
}

// For testing purposes, expose the emergency listener to the global scope
// You may remove this in production
window._emergencyListener = EmergencyListener;