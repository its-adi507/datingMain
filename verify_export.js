const { app, httpServer } = require('./server');
if (app && httpServer) {
    console.log('✅ Export check passed');
} else {
    console.error('❌ Exports missing');
    process.exit(1);
}

// Check if server is listening (it shouldn't be)
if (httpServer.listening) {
    console.error('❌ Server shouldn\'t be listening when imported');
    process.exit(1);
} else {
    console.log('✅ Server not auto-listening');
}
