module.exports = {
  apps: [{
    name: "ara-backend",
    cwd: __dirname,
    script: "server.js",
    node_args: "--enable-source-maps",
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    watch: false,
    max_memory_restart: "450M",
    kill_timeout: 12000,
    listen_timeout: 15000,
    wait_ready: false,
    time: true,
    merge_logs: true,
    env: { NODE_ENV: "production" }
  }]
};
