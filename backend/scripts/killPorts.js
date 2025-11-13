#!/usr/bin/env node

/**
 * Kill processes running on common service ports
 * Usage: node scripts/killPorts.js
 */

const { execSync } = require("child_process");

const ports = [3000, 3002, 3003, 3004, 3005, 3006, 3007, 3008];

console.log("Killing processes on service ports...\n");

ports.forEach(port => {
  try {
    const pid = execSync(`lsof -ti:${port}`, { encoding: "utf8" }).trim();
    if (pid) {
      const pids = pid.split("\n").filter(p => p);
      pids.forEach(pid => {
        try {
          execSync(`kill -9 ${pid}`, { encoding: "utf8" });
          console.log(`✓ Killed process ${pid} on port ${port}`);
        } catch (error) {
          console.log(`✗ Failed to kill process ${pid} on port ${port}`);
        }
      });
    } else {
      console.log(`○ No process found on port ${port}`);
    }
  } catch (error) {
    // Port is free
    console.log(`○ No process found on port ${port}`);
  }
});

console.log("\nDone! You can now start your services.");






