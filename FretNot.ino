#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <map>
#include <vector>
#include <array>

// ================= LASER MATRIX CLASS =================
class LaserMatrix {
public:
    LaserMatrix() {
        for (auto& row : MATRIX_PIN_MAP) {
            for (int pin : row) {
                if (pin != -1) pinMode(pin, OUTPUT);
            }
        }
    }

    void turnAllOff() const {
        for (auto& row : MATRIX_PIN_MAP) {
            for (int pin : row) {
                if (pin != -1) digitalWrite(pin, LOW);
            }
        }
    }

    void displayChord(const String& chord) const {
        auto it = chordMap.find(chord);
        if (it == chordMap.end()) {
            Serial.println("Unknown chord");
            return;
        }

        for (int pin : it->second) {
            if (pin != -1) {
                digitalWrite(pin, HIGH);
                Serial.printf("Pin %d ON\n", pin);
            }
        }
    }

private:
    const std::array<std::array<int, 6>, 3> MATRIX_PIN_MAP {{
        {23, 22, 21, -1, -1, -1},
        {-1, -1, 19, 18, 5, -1},
        {-1, -1, -1, 17, 16, -1}
    }};

    const std::map<String, std::vector<int>> chordMap {
        {"c", {MATRIX_PIN_MAP[0][1], MATRIX_PIN_MAP[1][3], MATRIX_PIN_MAP[2][4]}},
        {"e", {MATRIX_PIN_MAP[0][2], MATRIX_PIN_MAP[1][3], MATRIX_PIN_MAP[1][4]}},
        {"f", {MATRIX_PIN_MAP[0][1], MATRIX_PIN_MAP[1][2], MATRIX_PIN_MAP[2][3], MATRIX_PIN_MAP[2][4]}},
        {"fm", {MATRIX_PIN_MAP[0][0], MATRIX_PIN_MAP[0][1], MATRIX_PIN_MAP[0][2], MATRIX_PIN_MAP[2][3]}},
    };
};

// ================= BLE CALLBACKS =================
bool deviceConnected = false;
bool oldDeviceConnected = false;
BLEServer* pServer = nullptr;
BLECharacteristic* pChordCharacteristic = nullptr;

#define SERVICE_UUID              "19b10000-e8f2-537e-4f6c-d104768a1214"
#define CHORD_CHARACTERISTIC_UUID "19b10002-e8f2-537e-4f6c-d104768a1214"

class ConnectionCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer*) override { deviceConnected = true; }
  void onDisconnect(BLEServer*) override { deviceConnected = false; }
};

class GPIOCallbacks : public BLECharacteristicCallbacks {
  public:
      GPIOCallbacks(LaserMatrix& matrix) : matrix(matrix) {}

      void onWrite(BLECharacteristic* pCharacteristic) override {
          String value = pCharacteristic->getValue().c_str();
          Serial.printf("Received: %s\n", value.c_str());
          matrix.turnAllOff();
          matrix.displayChord(value);
      }

  private:
      LaserMatrix& matrix;
};

// ================= SETUP & LOOP =================
LaserMatrix matrix;

void setup() {
    Serial.begin(115200);
    BLEDevice::init("FretNot");

    pServer = BLEDevice::createServer();
    pServer->setCallbacks(new ConnectionCallbacks());

    BLEService* pService = pServer->createService(SERVICE_UUID);
    pChordCharacteristic = pService->createCharacteristic(
        CHORD_CHARACTERISTIC_UUID,
        BLECharacteristic::PROPERTY_WRITE
    );

    pChordCharacteristic->setCallbacks(new GPIOCallbacks(matrix));
    pChordCharacteristic->addDescriptor(new BLE2902());
    pService->start();

    BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->setScanResponse(false);
    pAdvertising->setMinPreferred(0x0);
    BLEDevice::startAdvertising();

    Serial.println("Waiting for a client connection...");
}

void loop() {
    if (!deviceConnected && oldDeviceConnected) {
        Serial.println("Device disconnected.");
        delay(500);
        pServer->startAdvertising();
        Serial.println("Restarted advertising.");
        oldDeviceConnected = deviceConnected;
    }

    if (deviceConnected && !oldDeviceConnected) {
        Serial.println("Device connected.");
        oldDeviceConnected = deviceConnected;
    }
}
