package es.mesacarlos.webconsole;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.security.KeyStore;
import java.util.concurrent.Executors;

import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManagerFactory;

import org.bukkit.Bukkit;
import org.bukkit.plugin.java.JavaPlugin;
import org.java_websocket.server.DefaultSSLWebSocketServerFactory;

import es.mesacarlos.webconsole.config.ConfigManager;
import es.mesacarlos.webconsole.minecraft.WebConsoleCommand;
import es.mesacarlos.webconsole.util.Internationalization;
import es.mesacarlos.webconsole.util.TpsTracker;
import es.mesacarlos.webconsole.web.StaticHandler;
import es.mesacarlos.webconsole.websocket.WSServer;

import com.sun.net.httpserver.HttpServer;

public class WebConsole extends JavaPlugin {
    
    private WSServer server;
    private Thread wsThread;
    private HttpServer httpServer;
    private Thread httpThread;

    @Override
    public void onEnable() {
        Bukkit.getServer().getScheduler().scheduleSyncRepeatingTask(this, new TpsTracker(), 100L, 1L);
        Internationalization.setCurrentLocale(ConfigManager.getInstance().getLanguage());
        
        // Start WebSocket Server for console
        try {
            startWS();
        } catch (Exception e) {
            Bukkit.getLogger().warning("[WebConsole] Failed to start WebSocket server: " + e.getMessage());
        }
        
        // Start HTTP Server for web dashboard
        try {
            startHTTPServer();
        } catch (Exception e) {
            Bukkit.getLogger().warning("[WebConsole] Failed to start HTTP server: " + e.getMessage());
        }

        // Log filter for console
        org.apache.logging.log4j.core.Filter f = new es.mesacarlos.webconsole.util.LogFilter(getWSServer());
        ((org.apache.logging.log4j.core.Logger) org.apache.logging.log4j.LogManager.getRootLogger()).addFilter(f);
        
        // Register /WebConsole command
        getCommand("WebConsole").setExecutor(new WebConsoleCommand(this.getDescription().getVersion()));
    }

    @Override
    public void onDisable() {
        try {
            if (server != null) server.stop();
            if (wsThread != null) wsThread = null;
            if (httpServer != null) httpServer.stop(0);
            if (httpThread != null) httpThread = null;
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * Start WebSocket server for console functionality
     */
    private void startWS() throws Exception {
        server = new WSServer(ConfigManager.getInstance().getSocketAdress());
        
        if (ConfigManager.getInstance().isSslEnabled()) {
            String STORETYPE = ConfigManager.getInstance().getStoreType();
            String KEYSTORE = ConfigManager.getInstance().getKeyStore();
            String STOREPASSWORD = ConfigManager.getInstance().getStorePassword();
            String KEYPASSWORD = ConfigManager.getInstance().getKeyPassword();
            
            KeyStore ks = KeyStore.getInstance(STORETYPE);
            File kf = new File(KEYSTORE);
            ks.load(new FileInputStream(kf), STOREPASSWORD.toCharArray());
            
            KeyManagerFactory kmf = KeyManagerFactory.getInstance("SunX509");
            kmf.init(ks, KEYPASSWORD.toCharArray());
            TrustManagerFactory tmf = TrustManagerFactory.getInstance("SunX509");
            tmf.init(ks);
            
            SSLContext sslContext = SSLContext.getInstance("TLS");
            sslContext.init(kmf.getKeyManagers(), tmf.getTrustManagers(), null);
            
            org.java_websocket.server.DefaultSSLWebSocketServerFactory factory = 
                new org.java_websocket.server.DefaultSSLWebSocketServerFactory(sslContext);
            server.setWebSocketFactory(factory);
        }

        wsThread = new Thread(new Runnable() {
            @Override
            public void run() {
                server.run();
            }
        });
        wsThread.start();
        
        Bukkit.getLogger().info("[WebConsole] WebSocket server started on port " + 
            ConfigManager.getInstance().getSocketAdress().getPort());
    }

    /**
     * Start HTTP server for embedded web dashboard
     */
    private void startHTTPServer() throws IOException {
        int httpPort = ConfigManager.getInstance().getPort();
        
        // Try to create HTTP server, fallback to alternative ports if needed
        HttpServer server = null;
        int[] portsToTry = {httpPort, httpPort + 1, httpPort + 2, 8080, 8090, 8100};
        
        for (int port : portsToTry) {
            try {
                server = HttpServer.create(new InetSocketAddress(port), 0);
                httpPort = port;
                break;
            } catch (java.net.BindException e) {
                Bukkit.getLogger().warning("[WebConsole] Port " + port + " is in use, trying next port...");
                continue;
            }
        }
        
        if (server == null) {
            Bukkit.getLogger().severe("[WebConsole] Failed to start HTTP server: all ports in use");
            return;
        }
        
        httpServer = server;
        httpServer.setExecutor(Executors.newCachedThreadPool());
        
        // Register static file handler
        httpServer.createContext("/", new StaticHandler());
        
        httpServer.start();
        
        if (httpPort == ConfigManager.getInstance().getPort()) {
            Bukkit.getLogger().info("[WebConsole] Web dashboard started on http://0.0.0.0:" + httpPort);
        } else {
            Bukkit.getLogger().warning("[WebConsole] Web dashboard started on http://0.0.0.0:" + httpPort + " (configured port was " + ConfigManager.getInstance().getPort() + ")");
        }
        Bukkit.getLogger().info("[WebConsole] Access the dashboard at: http://YOUR_SERVER_IP:" + httpPort);
    }

    public WSServer getWSServer() {
        return server;
    }
}
