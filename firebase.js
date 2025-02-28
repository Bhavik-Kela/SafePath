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

// Stop tracking live location function stopLiveLocation() {
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

// Initialize Google Maps when the window loads
window.onload = () => {
    initMap();
};


