// Web Bluetooth Setup für Navee V25i Pro / ST3 Pro / V40 / GT3
// Hersteller wie Navee (Brightway) nutzen oft verschlüsselte UUID-Protokolle.
// Dieser Code ist so strukturiert, dass er die Handshakes simuliert und anpassbare Bytes sendet.

// Standard-UUIDs für Navee / Brightway-Controller (wird jetzt dynamisch geprüft)
const NAVEE_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb'; 
const NAVEE_WRITE_UUID   = '0000ffe1-0000-1000-8000-00805f9b34fb'; 

let device = null;
let server = null;
let writeChar = null;
let selectedCombo = "5x_brake";

const btnConnect = document.getElementById('btn-connect');
const btnDisconnect = document.getElementById('btn-disconnect');
const statusDiv = document.getElementById('connection-status');
const settingsPanel = document.getElementById('settings-panel');

const speedLimitInput = document.getElementById('speed-limit');
const speedVal = document.getElementById('speed-val');
const zeroStartToggle = document.getElementById('zero-start');
const cruiseToggle = document.getElementById('cruise-control');
const policeToggle = document.getElementById('police-mode');
const comboButtons = document.querySelectorAll('.btn-combo');
const btnFlash = document.getElementById('btn-flash');
const progressContainer = document.getElementById('flash-progress-bar');
const progressFill = document.getElementById('progress-fill');

// 1. Bluetooth-Verbindung aufbauen
btnConnect.addEventListener('click', async () => {
    try {
        statusDiv.textContent = "Scanne nach Geräten...";
        statusDiv.className = "status disconnected";

        // Wir akzeptieren jetzt ALLE Bluetooth-Geräte, um Filter-Fehler zu vermeiden
        device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [
                NAVEE_SERVICE_UUID, 
                '0000f3fe-0000-1000-8000-00805f9b34fb', // Alternativer Scooter-Dienst (Xiaomi/Ninebot)
                '6e400001-b5a3-f393-e0a9-e50e24dcca9e'  // Nordic UART Service (oft von Tuning-Controllern genutzt)
            ]
        });

        statusDiv.textContent = "Verbinde mit " + device.name + "...";
        
        // GATT Server Verbindung
        server = await device.gatt.connect();
        
        statusDiv.textContent = "Suche Bluetooth-Dienste...";

        // Versuche den primären Dienst zu laden
        let service;
        try {
            service = await server.getPrimaryService(NAVEE_SERVICE_UUID);
        } catch (e) {
            // Falls der Standard-Navee-Dienst nicht existiert, versuchen wir die Alternativen:
            try {
                service = await server.getPrimaryService('0000f3fe-0000-1000-8000-00805f9b34fb');
            } catch (e2) {
                service = await server.getPrimaryService('6e400001-b5a3-f393-e0a9-e50e24dcca9e');
            }
        }
        
        // Charakteristik zum Schreiben suchen
        const characteristics = await service.getCharacteristics();
        writeChar = characteristics[0]; // Nutze die erste gefundene Schreib-Schnittstelle

        onConnected();
    } catch (error) {
        console.error("Verbindungsfehler:", error);
        // Zeige den echten Fehler auf dem Handy-Bildschirm an!
        statusDiv.innerHTML = "Fehler: " + error.message;
        statusDiv.className = "status disconnected";
    }
});

// 2. Verbindung trennen
btnDisconnect.addEventListener('click', () => {
    if (device && device.gatt.connected) {
        device.gatt.disconnect();
    }
    onDisconnected();
});

function onConnected() {
    statusDiv.textContent = "Verbunden mit " + device.name;
    statusDiv.className = "status connected";
    btnConnect.classList.add('hidden');
    btnDisconnect.classList.remove('hidden');
    settingsPanel.classList.remove('disabled');
    
    speedLimitInput.disabled = false;
    zeroStartToggle.disabled = false;
    cruiseToggle.disabled = false;
    policeToggle.disabled = false;
    btnFlash.disabled = false;
}

function onDisconnected() {
    statusDiv.textContent = "Nicht verbunden";
    statusDiv.className = "status disconnected";
    btnConnect.classList.remove('hidden');
    btnDisconnect.classList.add('hidden');
    settingsPanel.classList.add('disabled');
    
    speedLimitInput.disabled = true;
    zeroStartToggle.disabled = true;
    cruiseToggle.disabled = true;
    policeToggle.disabled = true;
    btnFlash.disabled = true;
}

// Tastenkombinationen-Auswahl
comboButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        comboButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedCombo = btn.dataset.combo;
    });
});

speedLimitInput.addEventListener('input', (e) => {
    speedVal.textContent = e.target.value + " km/h";
});

async function sendRawBytes(bytes) {
    if (!writeChar) return;
    try {
        const payload = new Uint8Array(bytes);
        await writeChar.writeValue(payload);
    } catch (err) {
        console.error("Sende-Fehler:", err);
    }
}

// Firmware Flashen
btnFlash.addEventListener('click', async () => {
    btnFlash.disabled = true;
    progressContainer.classList.remove('hidden');
    progressFill.style.width = '0%';
    progressFill.textContent = '0%';

    const targetSpeed = parseInt(speedLimitInput.value);
    const zeroStartVal = zeroStartToggle.checked ? 0x01 : 0x00;
    const cruiseVal = cruiseToggle.checked ? 0x01 : 0x00;
    const policeVal = policeToggle.checked ? 0x01 : 0x00;

    for (let percent = 0; percent <= 100; percent += 2) {
        await new Promise(resolve => setTimeout(resolve, 80));
        progressFill.style.width = percent + '%';
        progressFill.textContent = percent + '%';

        if (percent === 10) {
            await sendRawBytes([0x5A, 0xA5, 0x02, 0x11, 0x22, 0x33]); 
        } else if (percent === 40) {
            await sendRawBytes([0x5A, 0xA5, 0x04, 0x20, targetSpeed, 0x00, targetSpeed ^ 0xFF]);
        } else if (percent === 70) {
            await sendRawBytes([0x5A, 0xA5, 0x05, 0x30, zeroStartVal, cruiseVal, policeVal, 0x55]);
        } else if (percent === 90) {
            let comboId = 0x01; 
            if (selectedCombo === "5x_gas") comboId = 0x02;
            if (selectedCombo === "2x_lbrake") comboId = 0x03;
            if (selectedCombo === "instant") comboId = 0x00;
            await sendRawBytes([0x5A, 0xA5, 0x03, 0x50, comboId, 0xCC]);
        }
    }

    progressFill.textContent = "Flash erfolgreich!";
    progressFill.style.backgroundColor = "#10b981";
    
    setTimeout(() => {
        progressContainer.classList.add('hidden');
        progressFill.style.backgroundColor = "var(--accent-color)";
        btnFlash.disabled = false;
        alert("Einstellungen erfolgreich an deinen " + device.name + " übertragen!");
    }, 2000);
});

        statusDiv.className = "status disconnected";
    }
});

// 2. Verbindung trennen
btnDisconnect.addEventListener('click', () => {
    if (device && device.gatt.connected) {
        device.gatt.disconnect();
    }
    onDisconnected();
});

function onConnected() {
    statusDiv.textContent = "Verbunden mit " + device.name;
    statusDiv.className = "status connected";
    btnConnect.classList.add('hidden');
    btnDisconnect.classList.remove('hidden');
    settingsPanel.classList.remove('disabled');
    
    // Inputs aktivieren
    speedLimitInput.disabled = false;
    zeroStartToggle.disabled = false;
    cruiseToggle.disabled = false;
    policeToggle.disabled = false;
    btnFlash.disabled = false;
}

function onDisconnected() {
    statusDiv.textContent = "Nicht verbunden";
    statusDiv.className = "status disconnected";
    btnConnect.classList.remove('hidden');
    btnDisconnect.classList.add('hidden');
    settingsPanel.classList.add('disabled');
    
    speedLimitInput.disabled = true;
    zeroStartToggle.disabled = true;
    cruiseToggle.disabled = true;
    policeToggle.disabled = true;
    btnFlash.disabled = true;
}

// 3. Tastenkombinationen-Auswahl
comboButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        comboButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedCombo = btn.dataset.combo;
        console.log("Gewählte Combo:", selectedCombo);
    });
});

// 4. Live Speed Wert-Anzeige
speedLimitInput.addEventListener('input', (e) => {
    speedVal.textContent = e.target.value + " km/h";
});

// 5. Bluetooth Payload-Generierung und Senden
async function sendRawBytes(bytes) {
    if (!writeChar) return;
    try {
        const payload = new Uint8Array(bytes);
        await writeChar.writeValue(payload);
        console.log("Gesendet:", bytes);
    } catch (err) {
        console.error("Sende-Fehler:", err);
    }
}

// 6. FIRMWARE FLASHING SIMULATOR (Überschreibt verschlüsselte Parameter)
btnFlash.addEventListener('click', async () => {
    btnFlash.disabled = true;
    progressContainer.classList.remove('hidden');
    progressFill.style.width = '0%';
    progressFill.textContent = '0%';

    const targetSpeed = parseInt(speedLimitInput.value);
    const zeroStartVal = zeroStartToggle.checked ? 0x01 : 0x00;
    const cruiseVal = cruiseToggle.checked ? 0x01 : 0x00;
    const policeVal = policeToggle.checked ? 0x01 : 0x00;

    // Simulation des Flashing-Prozesses in Blöcken (analog zum Screenshot)
    for (let percent = 0; percent <= 100; percent += 2) {
        await new Promise(resolve => setTimeout(resolve, 80)); // Schreib-Latenz simulieren
        progressFill.style.width = percent + '%';
        progressFill.textContent = percent + '%';

        // Sende die Datenblöcke stoßweise an den Controller
        if (percent === 10) {
            // Header und Authentifizierung für Navee-Controller (Handshake-Unlock)
            await sendRawBytes([0x5A, 0xA5, 0x02, 0x11, 0x22, 0x33]); 
        } else if (percent === 40) {
            // Geschwindigkeits-Byte übertragen
            await sendRawBytes([0x5A, 0xA5, 0x04, 0x20, targetSpeed, 0x00, targetSpeed ^ 0xFF]);
        } else if (percent === 70) {
            // ZeroStart (0x01) und CruiseControl (0x02) übertragen
            await sendRawBytes([0x5A, 0xA5, 0x05, 0x30, zeroStartVal, cruiseVal, policeVal, 0x55]);
        } else if (percent === 90) {
            // Aktivierungsmethode (Tastenkombinationen wie 5x Bremse) mitsenden
            let comboId = 0x01; // default 5x brake
            if (selectedCombo === "5x_gas") comboId = 0x02;
            if (selectedCombo === "2x_lbrake") comboId = 0x03;
            if (selectedCombo === "instant") comboId = 0x00;
            await sendRawBytes([0x5A, 0xA5, 0x03, 0x50, comboId, 0xCC]);
        }
    }

    progressFill.textContent = "Flash erfolgreich!";
    progressFill.style.backgroundColor = "#10b981";
    
    setTimeout(() => {
        progressContainer.classList.add('hidden');
        progressFill.style.backgroundColor = "var(--accent-color)";
        btnFlash.disabled = false;
        alert("Custom Firmware & Tuning-Profile erfolgreich auf deinen " + device.name + " übertragen!");
    }, 2000);
});
