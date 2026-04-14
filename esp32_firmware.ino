/*
 * AquaControl Pro - ESP32 Firmware
 * --------------------------------
 * This code handles:
 * 1. WiFi Connection
 * 2. Firebase Firestore (Online Mode)
 * 3. BLE (Bluetooth Low Energy) (Offline Mode)
 * 
 * Libraries required:
 * - Firebase Arduino Client (by Mobizt)
 * - ArduinoJson
 * - ESP32 BLE Arduino
 */

#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <ArduinoJson.h>

// --- Configuration ---
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// From your firebase-applet-config.json
#define API_KEY "YOUR_API_KEY"
#define FIREBASE_PROJECT_ID "gen-lang-client-0124538063"
#define FIRESTORE_DATABASE_ID "ai-studio-170378da-e6ac-41bb-9009-3c587a27f340"

// Device ID (Must match the one in App.tsx)
#define DEVICE_ID "AQ-7729-F"

// BLE UUIDs (Must match App.tsx)
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define SETTINGS_CHAR_UUID  "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define TELEMETRY_CHAR_UUID "cba1d466-344c-4be3-ab3f-189f80dd7518"

// --- Global Objects ---
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

BLECharacteristic *pSettingsCharacteristic;
BLECharacteristic *pTelemetryCharacteristic;
bool deviceConnected = false;

// --- State Variables ---
float currentTemp = 27.5;
int humidity = 62;
int waterLevel = 85;

float targetTemp = 22.0;
String fanSpeed = "Med";
bool turboBoost = false;

// --- BLE Callbacks ---
class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
      Serial.println("Bluetooth Client Connected");
    };

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
      Serial.println("Bluetooth Client Disconnected");
      pServer->getAdvertising()->start(); // Restart advertising
    }
};

class SettingsCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String value = pCharacteristic->getValue().c_str();
      if (value.length() > 0) {
        Serial.print("New Settings via BLE: ");
        Serial.println(value);
        
        // Parse JSON from Web App
        StaticJsonDocument<200> doc;
        DeserializationError error = deserializeJson(doc, value);
        if (!error) {
          targetTemp = doc["targetTemp"];
          fanSpeed = doc["fanSpeed"].as<String>();
          turboBoost = doc["turboBoost"];
          // Apply settings to hardware here
        }
      }
    }
};

void setup() {
  Serial.begin(115200);

  // 1. WiFi Setup
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }
  Serial.println();
  Serial.print("Connected with IP: ");
  Serial.println(WiFi.localIP());

  // 2. Firebase Setup
  config.api_key = API_KEY;
  // For Firestore, we usually use anonymous auth or email/pass
  // Here we assume the device is authorized
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // 3. BLE Setup
  BLEDevice::init("ESP32-AquaControl");
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  pSettingsCharacteristic = pService->createCharacteristic(
                              SETTINGS_CHAR_UUID,
                              BLECharacteristic::PROPERTY_READ |
                              BLECharacteristic::PROPERTY_WRITE
                            );
  pSettingsCharacteristic->setCallbacks(new SettingsCallbacks());

  pTelemetryCharacteristic = pService->createCharacteristic(
                               TELEMETRY_CHAR_UUID,
                               BLECharacteristic::PROPERTY_NOTIFY
                             );

  pService->start();
  pServer->getAdvertising()->start();
  Serial.println("BLE Advertising Started");
}

unsigned long lastUpdate = 0;

void loop() {
  // Simulate sensor reading
  currentTemp += (random(-10, 11) / 100.0);
  
  // Update every 5 seconds
  if (millis() - lastUpdate > 5000) {
    lastUpdate = millis();

    // Update Firestore (Online)
    if (Firebase.ready()) {
      String path = "devices/" + String(DEVICE_ID) + "/telemetry/latest";
      FirebaseJson content;
      content.set("fields/currentTemp/doubleValue", currentTemp);
      content.set("fields/humidity/integerValue", humidity);
      content.set("fields/waterLevel/integerValue", waterLevel);
      // Note: Firestore REST API format is specific
      
      if (Firebase.Firestore.patchDocument(&fbdo, FIREBASE_PROJECT_ID, FIRESTORE_DATABASE_ID, path.c_str(), content.raw(), "currentTemp,humidity,waterLevel")) {
        Serial.println("Firestore Updated");
      } else {
        Serial.println(fbdo.errorReason());
      }
    }

    // Update BLE (Offline)
    if (deviceConnected) {
      StaticJsonDocument<100> doc;
      doc["temp"] = currentTemp;
      doc["hum"] = humidity;
      doc["water"] = waterLevel;
      String output;
      serializeJson(doc, output);
      pTelemetryCharacteristic->setValue(output.c_str());
      pTelemetryCharacteristic->notify();
    }
  }
}
