let device = null;
let server = null;
let readChar = null;
let keepAliveInterval = null;

const btnConnect = document.getElementById('btn-connect');
const btnDisconnect = document.getElementById('btn-disconnect');
const statusDiv = document.getElementById('connection-status');
const dashboard = document.getElementById('dashboard');

// Anzeige-Elemente
const txtSpeed = document.getElementById('current-speed');
const txtBattery = document.getElementById('battery-level');
const barBattery = document.getElementById('battery-bar');
const txtRange = document.getElementById('remaining-range');
const txtTemp = document.getElementById('motor-temp');
const txtVoltage = document.getElementById('voltage');
const txtOdo = document.getElementById('odo');

btnConnect.addEventListener('click', async () => {
    try {
        statusDiv.textContent = "Scanne nach Scooter...";
        statusDiv.className = "status disconnected";

        // Wir verbinden uns und abonnieren die Benachrichtigungen des Scooters
        device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [
                '0000ffe0-0000-1000-8000-00805f9b34fb', // Standard-Service
                '0000f3fe-0000-1000-8000-00805f9b34fb'  // Alternativ-Service
            ]
        });

        device.addEventListener('gattserverdisconnected', onDisconnected);
        statusDiv.textContent = "Kopple...";
        
        server = await device.gatt.connect();
        statusDiv.textContent = "Lese Datenkanäle...";

        const services = await server.getPrimaryServices();
        const service = services[0];
        const characteristics = await service.getCharacteristics();

        // Wir suchen die Schnittstelle, die uns Daten SENDER darf (Notify oder Read)
        readChar = characteristics.find(c => c.properties.notify || c.properties.indicate || c.properties.read);

        if (readChar) {
            // Wir aktivieren die Echtzeit-Datenübertragung vom Scooter
            if (readChar.properties.notify) {
                await readChar.startNotifications();
                readChar.addEventListener('characteristicvaluechanged', handleScooterData);
            }
            onConnected();
        } else {
            throw new Error("Datenkanal konnte nicht geöffnet werden.");
        }

    } catch (error) {
        console.error(error);
        statusDiv.innerHTML = "Fehler: " + error.message;
    }
});

btnDisconnect.addEventListener('click', () => {
    if (device && device.gatt.connected) {
        device.gatt.disconnect();
    }
    onDisconnected();
});

// Hier werden die eintreffenden Bluetooth-Bytes vom Scooter verarbeitet
function handleScooterData(event) {
    const value = event.target.value;
    
    // Da wir rohe Bytes empfangen, müssen wir sie auslesen.
    // Das Datenprotokoll variiert je nach Firmware-Version. 
    // Hier ist das Standard-Parsing für typische Navee/Brightway Telemetriedaten:
    try {
        if (value.byteLength >= 6) {
            // Beispielhaftes Auslesen (Dies sind Standard-Offsets für Navee-Controller):
            
            // 1. Geschwindigkeit (oft an Byte-Position 4 oder 5 in 1/10 km/h)
            let speed = value.getUint8(4); 
            if (speed > 100) speed = 0; // Fehlerkorrektur
            txtSpeed.textContent = speed.toString().padStart(2, '0');

            // 2. Akkustand (oft an Byte-Position 6 in %)
            let battery = value.getUint8(5);
            if (battery > 100) battery = 100;
            if (battery < 0) battery = 0;
            
            txtBattery.textContent = battery + "%";
            barBattery.style.width = battery + "%";

            // Reichweite berechnen (Navee V25i schafft max ca. 25km bei 100% Akku)
            let maxRange = 25; 
            let calculatedRange = Math.round((battery / 100) * maxRange);
            txtRange.textContent = calculatedRange + " km";

            // 3. Zusatzdaten (Spannung & Temperatur falls im Datenpaket vorhanden)
            if (value.byteLength >= 10) {
                let temp = value.getUint8(8);
                let volt = value.getUint16(6, true) / 100; // in Volt
                
                if (temp > 0 && temp < 100) txtTemp.textContent = temp + " °C";
                if (volt > 30 && volt < 60) txtVoltage.textContent = volt.toFixed(1) + " V";
            }
        }
    } catch (e) {
        console.warn("Fehler beim Dekodieren der Live-Daten:", e);
    }
}

function onConnected() {
    statusDiv.textContent = "Dashboard Aktiv!";
    statusDiv.className = "status connected";
    btnConnect.classList.add('hidden');
    btnDisconnect.classList.remove('hidden');
    dashboard.classList.remove('disabled');

    // Wir senden alle 2 Sekunden eine Abfrage, damit der Scooter aktiv sendet
    keepAliveInterval = setInterval(async () => {
        if (readChar && device.gatt.connected) {
            try {
                // Sende standardmäßigen Abfrage-Befehl (Query State)
                await readChar.writeValue(new Uint8Array([0x5A, 0xA5, 0x01, 0x10, 0x00, 0xEB]));
            } catch (err) {
                console.log("Ping fehlgeschlagen");
            }
        }
    }, 2000);
}

function onDisconnected() {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
    }
    statusDiv.textContent = "Verbindung getrennt";
    statusDiv.className = "status disconnected";
    btnConnect.classList.remove('hidden');
    btnDisconnect.classList.add('hidden');
    dashboard.classList.add('disabled');
    }
    
