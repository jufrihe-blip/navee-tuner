let device = null;
let server = null;
let readChar = null;
let keepAliveInterval = null;

const btnConnect = document.getElementById('btn-connect');
const btnDisconnect = document.getElementById('btn-disconnect');
const statusDiv = document.getElementById('connection-status');
const dashboard = document.getElementById('dashboard');

// Cockpit-Anzeige-Elemente
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

        device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [
                '0000ffe0-0000-1000-8000-00805f9b34fb',
                '0000f3fe-0000-1000-8000-00805f9b34fb'
            ]
        });

        device.addEventListener('gattserverdisconnected', onDisconnected);
        statusDiv.textContent = "Kopple...";
        
        server = await device.gatt.connect();
        statusDiv.textContent = "Lese Datenkanäle...";

        const services = await server.getPrimaryServices();
        const service = services[0];
        const characteristics = await service.getCharacteristics();

        readChar = characteristics.find(c => c.properties.notify || c.properties.indicate || c.properties.read);

        if (readChar) {
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
        statusDiv.className = "status disconnected";
    }
});

if (btnDisconnect) {
    btnDisconnect.addEventListener('click', () => {
        if (device && device.gatt.connected) {
            device.gatt.disconnect();
        }
        onDisconnected();
    });
}

function handleScooterData(event) {
    const value = event.target.value;
    try {
        if (value.byteLength >= 6) {
            let speed = value.getUint8(4); 
            if (speed > 100) speed = 0;
            if (txtSpeed) txtSpeed.textContent = speed.toString().padStart(2, '0');

            let battery = value.getUint8(5);
            if (battery > 100) battery = 100;
            if (battery < 0) battery = 0;
            
            if (txtBattery) txtBattery.textContent = battery + "%";
            if (barBattery) barBattery.style.width = battery + "%";

            let maxRange = 25; 
            let calculatedRange = Math.round((battery / 100) * maxRange);
            if (txtRange) txtRange.textContent = calculatedRange + " km";

            if (value.byteLength >= 10) {
                let temp = value.getUint8(8);
                let volt = value.getUint16(6, true) / 100;
                
                if (temp > 0 && temp < 100 && txtTemp) txtTemp.textContent = temp + " °C";
                if (volt > 30 && volt < 60 && txtVoltage) txtVoltage.textContent = volt.toFixed(1) + " V";
            }
        }
    } catch (e) {
        console.warn("Fehler beim Dekodieren:", e);
    }
}

function onConnected() {
    if (statusDiv) {
        statusDiv.textContent = "Dashboard Aktiv!";
        statusDiv.className = "status connected";
    }
    if (btnConnect) btnConnect.classList.add('hidden');
    if (btnDisconnect) btnDisconnect.classList.remove('hidden');
    if (dashboard) dashboard.classList.remove('disabled');

    keepAliveInterval = setInterval(async () => {
        if (readChar && device.gatt.connected) {
            try {
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
    if (statusDiv) {
        statusDiv.textContent = "Verbindung getrennt";
        statusDiv.className = "status disconnected";
    }
    if (btnConnect) btnConnect.classList.remove('hidden');
    if (btnDisconnect) btnDisconnect.classList.add('hidden');
    if (dashboard) dashboard.classList.add('disabled');
            }
