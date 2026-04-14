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
bool pumpStatus = false;
bool autoFill = true;

// --- Hardware Pins ---
#define FAN_RELAY_PIN 18    // AC Fan Relay
#define PUMP_RELAY_PIN 19   // AC Pump Relay
#define WATER_LEVEL_PIN 34  // Analog Sensor

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
        StaticJsonDocument<256> doc;
        DeserializationError error = deserializeJson(doc, value);
        if (!error) {
          if (doc.containsKey("targetTemp")) targetTemp = doc["targetTemp"];
          if (doc.containsKey("fanSpeed")) fanSpeed = doc["fanSpeed"].as<String>();
          if (doc.containsKey("turboBoost")) turboBoost = doc["turboBoost"];
          if (doc.containsKey("pumpStatus")) pumpStatus = doc["pumpStatus"];
          if (doc.containsKey("autoFill")) autoFill = doc["autoFill"];
        }
      }
    }
};

void setup() {
  Serial.begin(115200);

  // Hardware Setup
  pinMode(FAN_RELAY_PIN, OUTPUT);
  pinMode(PUMP_RELAY_PIN, OUTPUT);
  digitalWrite(FAN_RELAY_PIN, HIGH); // Relays are active LOW usually
  digitalWrite(PUMP_RELAY_PIN, HIGH);

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
  // 1. Read Sensors
  // currentTemp = dht.readTemperature();
  // humidity = dht.readHumidity();
  int rawLevel = analogRead(WATER_LEVEL_PIN);
  waterLevel = map(rawLevel, 0, 4095, 0, 100);

  // 2. Auto-Fill Logic
  if (autoFill) {
    if (waterLevel < 20) pumpStatus = true;   // Start filling if low
    if (waterLevel >= 95) pumpStatus = false; // Stop when full
  }

  // 3. Apply Hardware States (Active LOW Relays)
  digitalWrite(PUMP_RELAY_PIN, pumpStatus ? LOW : HIGH);
  
  if (fanSpeed == "Off") digitalWrite(FAN_RELAY_PIN, HIGH);
  else digitalWrite(FAN_RELAY_PIN, LOW); // Simplified for Relay

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
