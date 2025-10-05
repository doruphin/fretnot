#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

BLEServer* pServer = NULL;
BLECharacteristic* pChordCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;

const int MATRIX_PIN_MAP[3][6] = {
  {23,
  22,
  21,
  -1,
  -1,
  -1},
  {-1,
  -1,
  19,
  18,
  5,
  -1},
  {-1,
  -1,
  -1,
  17,
  16,
  -1}
};

std::map<String, std::vector<int>> chordMap = {
  {"c", {MATRIX_PIN_MAP[0][1], MATRIX_PIN_MAP[1][3], MATRIX_PIN_MAP[2][4]}},
  {"e", {MATRIX_PIN_MAP[0][2], MATRIX_PIN_MAP[1][3], MATRIX_PIN_MAP[1][4]}},
  {"f", {MATRIX_PIN_MAP[0][1], MATRIX_PIN_MAP[1][2], MATRIX_PIN_MAP[2][3], MATRIX_PIN_MAP[2][4]}},
  {"fm", {MATRIX_PIN_MAP[0][0], MATRIX_PIN_MAP[0][1], MATRIX_PIN_MAP[0][2], MATRIX_PIN_MAP[2][3]}},
};

// See the following for generating UUIDs:
// https://www.uuidgenerator.net/
#define SERVICE_UUID        "19b10000-e8f2-537e-4f6c-d104768a1214"
#define CHORD_CHARACTERISTIC_UUID "19b10002-e8f2-537e-4f6c-d104768a1214"

class ConnectionCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
  };

  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
  }
};

class GPIOCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pChordCharacteristic) {
    String value = pChordCharacteristic->getValue(); 
    Serial.println(value.c_str());

    if (value.length() > 0) {
      turnAllLasersOff();
      displayChord(chordMap[value]);
    }
  }

  void turnAllLasersOff() {
    for (int x = 0; x < 3; x++) {
      for (int y = 0; y < 6; y++) {
        digitalWrite(MATRIX_PIN_MAP[x][y], LOW);
      }
    }
  }

  void displayChord(const std::vector<int>& chordPins) {
    for (int pin : chordPins) {
      if (pin != -1) {
        digitalWrite(pin, HIGH);
        Serial.println(pin);
       } else {
        Serial.println("WARNING: unsupported section requested");
       } 
    }
      
  }
};

void setup() {
  Serial.begin(115200);

  // Set all of the pins defined to output
  for (int x = 0; x < 3; x++) {
    for (int y = 0; y < 6; y++) {
      pinMode(MATRIX_PIN_MAP[x][y], OUTPUT);
    }
  }

  // Create the BLE Device
  BLEDevice::init("FretNot");

  // Create the BLE Server
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ConnectionCallbacks());

  // Create the BLE Service
  BLEService *pService = pServer->createService(SERVICE_UUID);

  // Create the chord buttons Characteristic
  pChordCharacteristic = pService->createCharacteristic(
                      CHORD_CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_WRITE
                    );

  // Register the callback for the ON button characteristic
  pChordCharacteristic->setCallbacks(new GPIOCallbacks());

  // https://www.bluetooth.com/specifications/gatt/viewer?attributeXmlFile=org.bluetooth.descriptor.gatt.client_characteristic_configuration.xml
  // Create a BLE Descriptor
  pChordCharacteristic->addDescriptor(new BLE2902());

  // Start the service
  pService->start();

  // Start advertising
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(false);
  pAdvertising->setMinPreferred(0x0);  // set value to 0x00 to not advertise this parameter
  BLEDevice::startAdvertising();
  Serial.println("Waiting a client connection to notify...");
}

void loop() {
  // disconnecting
  if (!deviceConnected && oldDeviceConnected) {
    Serial.println("Device disconnected.");
    delay(500); // give the bluetooth stack the chance to get things ready
    pServer->startAdvertising(); // restart advertising
    Serial.println("Start advertising");
    oldDeviceConnected = deviceConnected;
  }
  // connecting
  if (deviceConnected && !oldDeviceConnected) {
    // do stuff here on connecting
    oldDeviceConnected = deviceConnected;
    Serial.println("Device Connected");
  }
}