let device = null;
let server = null;
let writeChar = null;
let selectedCombo = "5x_brake";
let keepAliveInterval = null; // Timer für das Wachhalten der Verbindung

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

btnConnect.addEventListener('click', async () => {
    try {
        statusDiv.textContent = "Scanne nach Scootern...";
        statusDiv.className = "status disconnected";

        device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [
                '0000ffe0-0000-1000-8000-00805f9b34fb',
                '0000f3fe-0000-1000-8000-00805f9b34fb',
                '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
                '0000180a-0000-1000-8000-00805f9b34fb',
                '00001801-0000-1000-8000-00805f9b34fb'
            ]
        });

        // Event-Listener, falls der Scooter von sich aus trennt
        device.addEventListener('gattserverdisconnected', onDisconnected);

        statusDiv.textContent = "Kopple mit " + device.name + "...";
        
        server = await device.gatt.connect();
        
        statusDiv.textContent = "Dienste werden geladen...";

        const services = await server.getPrimaryServices();
        if (services.length === 0) {
            throw new Error("Keine Bluetooth-Dienste auf dem Scooter gefunden.");
        }

        const service = services[0];
        
        const characteristics = await service.getCharacteristics();
        if (characteristics.length === 0) {
            throw new Error("Keine Schreib-Schnittstellen gefunden.");
        }

        writeChar = characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse);
        
        if (!writeChar) {
            writeChar = characteristics[0];
        }

        onConnected();
    } catch (error) {
        console.error("Verbindungsfehler:", error);
        statusDiv.innerHTML = "Fehler: " + error.message;
        statusDiv.className = "status disconnected";
    }
});

btnDisconnect.addEventListener('click', () => {
    if (device && device.gatt.connected) {
        device.gatt.disconnect();
    }
    onDisconnected();
});

function onConnected() {
    statusDiv.textContent = "Erfolgreich verbunden!";
    statusDiv.className = "status connected";
    btnConnect.classList.add('hidden');
    btnDisconnect.classList.remove('hidden');
    settingsPanel.classList.remove('disabled');
    
    speedLimitInput.disabled = false;
    zeroStartToggle.disabled = false;
    cruiseToggle.disabled = false;
    policeToggle.disabled = false;
    btnFlash.disabled = false;

    // --- START KEEP-ALIVE (VERBINDUNG WACHHALTEN) ---
    // Wir senden sofort einen ersten Handshake-Befehl
    sendRawBytes([0x5A, 0xA5, 0x01, 0x00, 0x00, 0xFB]); 

    // Alle 2 Sekunden senden wir ein kleines Signal, damit der Scooter aktiv bleibt
    if (keepAliveInterval) clearInterval(keepAliveInterval);
    keepAliveInterval = setInterval(async () => {
        if (device && device.gatt.connected && writeChar) {
            // Standard-Ping-Byte-Sequenz für Navee/Brightway Controller
            await sendRawBytes([0x5A, 0xA5, 0x01, 0x10, 0x00, 0xEB]);
        }
    }, 2000);
}

function onDisconnected() {
    // Timer stoppen, wenn die Verbindung getrennt wird
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
    }

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
        alert("Erfolgreich übertragen!");
    }, 2000);
});
                                   
