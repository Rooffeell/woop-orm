#!/usr/bin/env node
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');

// Load environment variables from the user's project root
// This allows the studio to access DATABASE_URL from the user's .env file
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

// Parse command line arguments
const args = process.argv.slice(2);
let requestedPort = parseInt(process.env.PORT || '3000', 10);

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' || args[i] === '-p') {
    const portArg = parseInt(args[i + 1], 10);
    if (!isNaN(portArg)) {
      requestedPort = portArg;
      i++; // Skip next arg since we consumed it
    }
  }
}

// Function to check if a port is in use
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        // Other errors, maybe permission denied, treat as unavailable
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close(() => {
        resolve(true);
      });
    });
    server.listen(port);
  });
}

// Find the next available port
async function findAvailablePort(startPort) {
  let port = startPort;
  while (!(await isPortAvailable(port))) {
    port++;
    if (port > 65535) {
      throw new Error('No available ports found.');
    }
  }
  return port;
}

(async () => {
  try {
    const port = await findAvailablePort(requestedPort);

    console.log("Starting Woop Studio...");
    console.log(`Database URL: ${process.env.DATABASE_URL ? 'Found' : 'Not Found (Please set DATABASE_URL in .env)'}`);
    console.log(`Port: ${port} ${port !== requestedPort ? `(Port ${requestedPort} was in use)` : ''}`);

    // Path to the standalone server
    // When installed as a dependency, the path will be relative to this file
    // The standalone build preserves the directory structure from the monorepo root
    // So it ends up deep inside .next/standalone
    const serverPath = path.resolve(__dirname, '../.next/standalone/studio/woop-studio/server.js');

    if (!fs.existsSync(serverPath)) {
      console.error("Error: Could not find Woop Studio server build.");
      console.error(`Expected at: ${serverPath}`);
      console.error("Please ensure the package is installed correctly.");
      process.exit(1);
    }

    // Start the Next.js standalone server
    const studio = spawn('node', [serverPath], {
      stdio: 'inherit',
      env: {
        ...process.env,
        PORT: port.toString(),
        HOSTNAME: '0.0.0.0'
      }
    });

    studio.on('close', (code) => {
      process.exit(code);
    });
  } catch (error) {
    console.error('Failed to start Woop Studio:', error);
    process.exit(1);
  }
})();
