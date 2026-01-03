package es.mesacarlos.webconsole;

import java.io.File;
import java.io.FileInputStream;
import java.net.InetSocketAddress;
import java.security.KeyStore;

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
import es.mesacarlos.webconsole.websocket.WSServer;

public class WebConsole extends JavaPlugin {
    
    private WSServer server;
    private Thread wsThread;

    @Override
    public void onEnable() {
        Bukkit.getServer().getScheduler().scheduleSyncRepeatingTask(this, new TpsTracker(), 100L, 1L);
        Internationalization.setCurrentLocale(ConfigManager.getInstance().getLanguage());
        
        try {
            startWS();
        } catch (Exception e) {
            Bukkit.getLogger().warning("[WebConsole] Failed to start WebSocket server: " + e.getMessage());
        }

        org.apache.logging.log4j.core.Filter f = new es.mesacarlos.webconsole.util.LogFilter(getWSServer());
        ((org.apache.logging.log4j.core.Logger) org.apache.logging.log4j.LogManager.getRootLogger()).addFilter(f);
        
        getCommand("WebConsole").setExecutor(new WebConsoleCommand(this.getDescription().getVersion()));
    }

    @Override
    public void onDisable() {
        try {
            if (server != null) server.stop();
            if (wsThread != null) wsThread = null;
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void startWS() throws Exception {
        int configuredPort = ConfigManager.getInstance().getSocketAdress().getPort();
        
        int[] wsPortsToTry = {configuredPort, configuredPort + 1, configuredPort + 2, 8070, 8080, 8090, 9000};
        
        for (int port : wsPortsToTry) {
            try {
                InetSocketAddress address = new InetSocketAddress(port);
                WSServer testServer = new WSServer(address);
                server = testServer;
                break;
            } catch (Exception e) {
                Bukkit.getLogger().warning("[WebConsole] Port " + port + " is in use, trying next...");
                continue;
            }
        }
        
        if (server == null) {
            throw new Exception("Failed to start WebSocket server on any port");
        }
        
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

    public WSServer getWSServer() {
        return server;
    }
}
