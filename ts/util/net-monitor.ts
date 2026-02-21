import fs from 'fs';

const INTERVAL = 60 * 60 * 1000; // 1 hour
const PROC_NET_DEV = '/proc/net/dev';

let timer: NodeJS.Timeout | null = null;
let lastTx = 0;
let lastRx = 0;
let iface: string | null = null;

function formatMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(2);
}

/**
 * Try sysfs first (/sys/class/net/<iface>/statistics/), fall back to
 * parsing /proc/net/dev. Works across Replit dev VMs and GCE prod.
 */
function readNetStats(): { tx: number; rx: number } | null {
  // Try sysfs for a known interface
  if (iface) {
    try {
      const tx = parseInt(fs.readFileSync(`/sys/class/net/${iface}/statistics/tx_bytes`, 'utf-8').trim(), 10);
      const rx = parseInt(fs.readFileSync(`/sys/class/net/${iface}/statistics/rx_bytes`, 'utf-8').trim(), 10);
      return { tx, rx };
    } catch {
      // sysfs gone (e.g. interface renamed), fall through to /proc/net/dev
    }
  }

  // Fall back to /proc/net/dev
  try {
    const content = fs.readFileSync(PROC_NET_DEV, 'utf-8');
    for (const line of content.split('\n')) {
      const match = line.match(/^\s*(\w+):\s+(\d+)\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+(\d+)/);
      if (match && match[1] !== 'lo') {
        iface = match[1]; // remember for sysfs next time
        return { tx: parseInt(match[3], 10), rx: parseInt(match[2], 10) };
      }
    }
  } catch {
    // /proc/net/dev not available either
  }

  return null;
}

function logStats(): void {
  const stats = readNetStats();
  if (!stats) return;

  const { tx, rx } = stats;
  const deltaTx = lastTx ? tx - lastTx : 0;
  const deltaRx = lastRx ? rx - lastRx : 0;

  if (lastTx) {
    console.log(`[net] egress: ${formatMB(tx)} MB total (+${formatMB(deltaTx)} MB) | ingress: ${formatMB(rx)} MB total (+${formatMB(deltaRx)} MB)`);
  } else {
    console.log(`[net] egress: ${formatMB(tx)} MB total | ingress: ${formatMB(rx)} MB total (initial, iface=${iface})`);
  }

  lastTx = tx;
  lastRx = rx;
}

export function startNetMonitor(): void {
  // Quick check: is any network stats source available?
  if (!readNetStats()) {
    console.log('[net] Network stats not available, monitor disabled');
    return;
  }

  logStats();
  timer = setInterval(logStats, INTERVAL);
  console.log('[net] Network monitor started (logging every 1 hr)');
}

export function stopNetMonitor(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  logStats(); // final reading
}
