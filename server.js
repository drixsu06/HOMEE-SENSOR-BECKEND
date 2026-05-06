
const express = require('express');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve frontend
app.use(express.static('public'));

// Serial port
let port;
let parser;

// Function to initialize serial port
async function initializeSerialPort() {
  try {
    // List available ports
    const ports = await SerialPort.list();
    console.log('Available ports:', ports);

    // Try to find COM7 or use the first available port
    const targetPort = ports.find(p => p.path === 'COM7') || ports[0];
    
    if (!targetPort) {
      console.error('No serial ports found. Please connect your device.');
      return;
    }

    console.log(`Attempting to connect to ${targetPort.path}`);

    port = new SerialPort({
      path: targetPort.path,
      baudRate: 9600,
    });

    port.on('open', () => {
      console.log(`Serial Port Opened on ${targetPort.path}`);
    });

    port.on('error', (err) => {
      console.error(`Serial Port Error (${targetPort.path}):`, err.message);
    });

    parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

    parser.on('data', (data) => {

      const cleanData = data.trim();

      console.log("RAW:", cleanData);

      if (cleanData !== "ERROR") {

        let [temp, humidity] = cleanData.split(",");

        temp = parseFloat(temp);
        humidity = parseFloat(humidity);

        // TEMP STATUS
        let tempStatus = "";

        if (temp < 20)
          tempStatus = "Cold";
        else if (temp <= 30)
          tempStatus = "Normal";
        else
          tempStatus = "Hot";

        let humidityStatus = "";

        if (humidity < 30)
          humidityStatus = "Low";
        else if (humidity <= 70)
          humidityStatus = "Normal";
        else
          humidityStatus = "High";

        // TIME
        const now = new Date();

        const time = now.toLocaleTimeString();

        const sensorData = {
          temp,
          humidity,
          tempStatus,
          humidityStatus,
          time
        };

        io.emit('sensorData', sensorData);

        console.log("Sent:", sensorData);
      }
    });
  } catch (err) {
    console.error('Failed to initialize serial port:', err.message);
  }
}

// Initialize serial port on startup
initializeSerialPort();

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});