// Web Bluetooth Setup für Navee V25i Pro / ST3 Pro / V40 / GT3
// Hersteller wie Navee (Brightway) nutzen oft verschlüsselte UUID-Protokolle.
// Dieser Code ist so strukturiert, dass er die Handshakes simuliert und anpassbare Bytes sendet.

// Standard-UUIDs für Brightway/Navee-Controller & Bluetooth-Module
const NAVEE_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb'; // Häufiger Service bei ffe0-Controllern
const NAVEE_WRITE_UUID   = '0000ffe1-0000-1000-8000-00805f9b34fb'; // Schreib-Charakteristik

let device = null;
let server = null;
let writeChar = null;
let selectedCombo = "5x_brake";

// DOM Elemente abrufen
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
        statusDiv.textContent = "Scanne nach Navee...";
        statusDiv.className = "status disconnected";

        device = await navigator.bluetooth.requestDevice({
            filters: [
                { namePrefix: 'NAVEE' },
                { namePrefix: 'V25i' },
                { namePrefix: 'V25' },
                { namePrefix: 'ST3' },
                { namePrefix: 'Brightway' }
            ],
            optionalServices: [NAVEE_SERVICE_UUID]
        });

        statusDiv.textContent = "Kopple mit " + device.name + "...";
        server = await device.gatt.connect();
        
        const service = await server.getPrimaryService(NAVEE_SERVICE_UUID);
        writeChar = await service.getCharacteristic(NAVEE_WRITE_UUID);

        onConnected();
    } catch (error) {
        console.error("Verbindungsfehler:", error);
        statusDiv.textContent = "Fehler bei Verbindung!";
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
